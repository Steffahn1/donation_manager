"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { slugify } from "@/lib/campaigns";
import { replaceableSignupWhere } from "@/lib/verification-rules";
import { Prisma } from "@/generated/prisma/client";
import { firstIssue } from "@/lib/form-errors";
import { campaignSchema, submittedCampaignValues } from "@/lib/campaign-form";

/**
 * `field` is the input the error is about, for aria-invalid. `values` echoes the submitted campaign
 * form back on an error, so React's form reset doesn't throw away what the admin typed (e.g. a long article).
 */
export type AdminFormState =
  | { error?: string; field?: string; success?: string; values?: Record<string, string> }
  | undefined;

/** Create (campaignId = null) or update a campaign. Super admin only. */
export async function saveCampaign(
  campaignId: string | null,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireRole("SUPER_ADMIN");

  const values = submittedCampaignValues(formData);
  const parsed = campaignSchema.safeParse(values);
  if (!parsed.success) return { ...firstIssue(parsed.error), values };
  const d = parsed.data;

  // The assigned user must really be a campaign manager.
  const manager = await db.user.findFirst({ where: { id: d.managerId, role: "CAMPAIGN_MANAGER" } });
  if (!manager) return { error: "Choose a valid campaign manager.", field: "managerId", values };

  const data = {
    name: d.name,
    description: d.description,
    story: d.story || null,
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
      await createWithUniqueSlug(d.name, data);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "That campaign no longer exists.", values };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Another campaign was saved with the same name at the same moment. Please save again.", values };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  redirect("/admin/campaigns");
}

/**
 * The slug check and the insert are not atomic, so two admins saving the same name at once can
 * collide on the unique slug. Retry with a fresh slug a couple of times before giving up.
 */
async function createWithUniqueSlug(name: string, data: Omit<Prisma.CampaignUncheckedCreateInput, "slug">) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.campaign.create({ data: { ...data, slug: await uniqueSlug(name) } });
    } catch (e) {
      const slugClash =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 3;
      if (!slugClash) throw e;
    }
  }
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
  if (!parsed.success) return firstIssue(parsed.error);
  const { name, email, password } = parsed.data;

  const passwordHash = await hashPassword(password);
  try {
    await db.$transaction(async (tx) => {
      // Someone may have started a donor signup with this email and never confirmed it. Such an account
      // has no password, sessions or donations, so it is safe to replace (its links stop working).
      // Any other existing account still blocks the email (the create below fails with P2002).
      await tx.user.deleteMany({ where: replaceableSignupWhere(email) });
      await tx.user.create({
        data: {
          name,
          email,
          role: "CAMPAIGN_MANAGER",
          passwordHash,
          emailVerifiedAt: new Date(), // created by the admin, so trusted
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "An account with that email already exists.", field: "email" };
    }
    throw e;
  }

  revalidatePath("/admin/managers");
  return { success: `Created ${email}. Share the initial password with them securely.` };
}
