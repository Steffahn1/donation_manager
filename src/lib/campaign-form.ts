import { z } from "zod";
import { formatZar, parseRandToCents } from "@/lib/money";
import { MAX_STORY_LENGTH, normaliseStory } from "@/lib/story";

/**
 * Validation for the super admin's campaign form (create and edit), kept out of the Server Action
 * file so it can be unit-tested. The action (src/app/actions/admin.ts) checks the role first.
 */

/** Campaign amounts are Postgres INT cents (max ~R21.4m); cap well below that. */
const MAX_CAMPAIGN_CENTS = 10_000_000_00; // R10 000 000

/** A real calendar date: "2026-02-31" matches the pattern but is rejected. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Use a valid date.");
const randAmount = z
  .string()
  .transform((v) => parseRandToCents(v))
  .refine((v): v is number => v !== null && v > 0, "Enter an amount in rand, e.g. 500 or 500,00.")
  .refine((v) => v <= MAX_CAMPAIGN_CENTS, `Amounts can be at most ${formatZar(MAX_CAMPAIGN_CENTS)}.`);

export const campaignSchema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters.").max(100),
    description: z.string().trim().min(10, "Add a short description.").max(5000),
    story: z
      .string()
      .transform(normaliseStory)
      .pipe(z.string().max(MAX_STORY_LENGTH, `The article can be at most ${MAX_STORY_LENGTH.toLocaleString("en-ZA")} characters.`)),
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
  .refine((d) => d.endDate >= d.startDate, { message: "End date must be on or after the start date.", path: ["endDate"] });

const CAMPAIGN_FIELDS = [
  "name", "description", "story", "target", "startDate", "endDate", "status",
  "imagePath", "impactAmount", "impactLabel", "managerId",
] as const;

/** The campaign form's text fields (missing ones as ""), so they can be validated and echoed back. */
export function submittedCampaignValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    CAMPAIGN_FIELDS.map((k) => {
      const v = formData.get(k);
      return [k, typeof v === "string" ? v : ""];
    }),
  );
}
