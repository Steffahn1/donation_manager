import "server-only";
import { db } from "@/lib/db";
import { isCheckoutSessionId } from "@/lib/stripe";

/**
 * Looks up a donation by its Stripe Checkout Session id for the success/cancelled pages.
 * Returns no donor details: these pages are reached by URL, so they show only
 * status, amount and campaign.
 */
export async function getDonationByCheckoutSession(sessionId: string | string[] | undefined) {
  if (!isCheckoutSessionId(sessionId)) return null;
  return db.donation.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: {
      status: true,
      amountCents: true,
      failureReason: true,
      campaign: { select: { name: true, slug: true, impactAmountCents: true, impactLabel: true } },
    },
  });
}
