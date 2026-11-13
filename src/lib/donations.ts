import { z } from "zod";
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS, formatZar, parseRandToCents } from "./money";

/** What the donor types on the donate form. Strings, exactly as submitted, so the form can be refilled. */
export type DonateValues = {
  name: string;
  email: string;
  amount: string;
  anonymous: boolean;
};

export const donationDetailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100, "Name is too long."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  amountCents: z
    .string()
    .transform((v) => parseRandToCents(v))
    .refine((v): v is number => v !== null, "Enter an amount in rand, e.g. 250 or 250.00.")
    .refine((v) => v >= MIN_DONATION_CENTS, `The minimum donation is ${formatZar(MIN_DONATION_CENTS)}.`)
    .refine((v) => v <= MAX_DONATION_CENTS, `The maximum donation is ${formatZar(MAX_DONATION_CENTS)}.`),
  anonymous: z.boolean(),
});

export type DonationDetails = z.output<typeof donationDetailsSchema>;

export function valuesFromForm(formData: FormData): DonateValues {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    name: str("name"),
    email: str("email"),
    amount: str("amount"),
    anonymous: str("anonymous") === "on" || str("anonymous") === "true",
  };
}

export function parseDonationDetails(values: DonateValues) {
  return donationDetailsSchema.safeParse({
    name: values.name,
    email: values.email,
    amountCents: values.amount,
    anonymous: values.anonymous,
  });
}

/** The confirm-step attempt id: a random URL-safe token from generateToken(). */
export const attemptIdSchema = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);
