import { receiptEmail, type EmailContent } from "./email-templates";

/**
 * Sending a receipt after a donation is paid (core logic; Stripe/DB/email injected, tested in
 * receipts.test.ts; wired in receipt-sender.ts).
 *
 * - Exactly once: the receipt token's hash is CLAIMED with a conditional update ("only if no receipt
 *   token yet") before the email goes out, so two webhook deliveries can never send two emails.
 * - Best effort: if the email fails, the payment is unaffected and nothing is retried (docs/PLAN.md).
 * - Only the hash is stored; the raw token exists only in the email.
 */

export type ReceiptData = {
  email: string;
  name: string;
  amountCents: number;
  campaignName: string;
  paidAt: Date;
  isAnonymous: boolean;
};

export type ReceiptDeps = {
  newToken(): string;
  hash(token: string): string;
  /** SUCCEEDED donation data, or null if it isn't (or no longer) a paid donation. */
  load(donationId: string): Promise<ReceiptData | null>;
  /** Stores the hash only if the donation has none yet. Returns false if a receipt was already claimed. */
  claim(donationId: string, tokenHash: string): Promise<boolean>;
  send(to: string, content: EmailContent): Promise<boolean>;
  appUrl: string;
};

export type ReceiptOutcome = "sent" | "already-sent" | "not-paid" | "email-failed";

export async function sendReceiptOnce(deps: ReceiptDeps, donationId: string): Promise<ReceiptOutcome> {
  const data = await deps.load(donationId);
  if (!data) return "not-paid";

  const token = deps.newToken();
  if (!(await deps.claim(donationId, deps.hash(token)))) return "already-sent";

  const content = receiptEmail({
    name: data.name,
    amountCents: data.amountCents,
    campaignName: data.campaignName,
    paidAt: data.paidAt,
    anonymous: data.isAnonymous,
    receiptUrl: `${deps.appUrl}/receipt/${token}`,
  });
  return (await deps.send(data.email, content)) ? "sent" : "email-failed";
}
