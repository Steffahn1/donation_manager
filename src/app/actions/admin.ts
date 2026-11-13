"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { slugify } from "@/lib/campaigns";
import { parseRandToCents } from "@/lib/money";
import { Prisma } from "@/generated/prisma/client";

export type AdminFormState = { error?: string; success?: string } | undefined;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const randAmount = z
  .string()
  .transform((v) => parseRandToCents(v))
  .refine((v): v is number => v !== null && v > 0, "Enter an amount in rand, e.g. 500 or 500.00.");

const campaignSchema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters.").max(100),
    description: z.string().trim().min(10, "Add a short description.").max(5000),
    target: randAmount,
    startDate: isoDate,
    endDate: isoDate,
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]),
    imagePath: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\/[\w\-./]+\.(jpg|jpeg|png|webp|svg)$/i.test(v) && !v.includes("..")), {
        message: "Image must be a path under /public, e.g. /campaigns/food.jpg",
      }),
    impactAmount: randAmount,
    impactLabel: z.string().trim().min(3, "Describe the impact, e.g. 'family fed for a week'.").max(80),
    managerId: z.string().min(1, "Choose a campaign manager."),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "End date must be on or after the start date." });

/** Create (campaignId = null) or update a campaign. Super admin only. */
export async function saveCampaign(
  campaignId: string | null,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireRole("SUPER_ADMIN");

  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // The assigned user must really be a campaign manager.
  const manager = await db.user.findFirst({ where: { id: d.managerId, role: "CAMPAIGN_MANAGER" } });
  if (!manager) return { error: "Choose a valid campaign manager." };

  const data = {
    name: d.name,
    description: d.description,
    targetCents: d.target,
    startDate: new Date(`${d.startDate}T00:00:00Z`),
    endDate: new Date(`${d.endDate}T00:00:00Z`),
    status: d.status,
    imagePath: d.imagePath || null,
    impactAmountCents: d.impactAmount,
    impactLabel: d.impactLabel,
    managerId: d.managerId,
  };

  try {
    if (campaignId) {
      await db.campaign.update({ where: { id: campaignId }, data });
    } else {
      await db.campaign.create({ data: { ...data, slug: await uniqueSlug(d.name) } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "That campaign no longer exists." };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  redirect("/admin/campaigns");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "campaign";
  let slug = base;
  for (let i = 2; await db.campaign.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

const managerSchema = z.object({
  name: z.string().trim().min(2, "Enter the manager's name.").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

/** Create a campaign manager account with an initial password. Super admin only. */
export async function createManager(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireRole("SUPER_ADMIN");

  const parsed = managerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  try {
    await db.user.create({
      data: {
        name,
        email,
        role: "CAMPAIGN_MANAGER",
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(), // created by the admin, so trusted
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "An account with that email already exists." };
    }
    throw e;
  }

  revalidatePath("/admin/managers");
  return { success: `Created ${email}. Share the initial password with them securely.` };
}
