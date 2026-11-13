import type Stripe from "stripe";
import type { DonationStatus } from "@/generated/prisma/client";

/**
 * Applies a verified Stripe webhook event to our database.
 *
 * Guarantees:
 * - Idempotent: the event id is inserted into StripeEvent in the same transaction
 *   as the donation update. A redelivered/replayed event hits the primary key and
 *   is ignored, so a donation is never counted twice.
 * - Status only moves forward: every update is conditional on the current status
 *   (e.g. only PENDING/FAILED can become SUCCEEDED, a SUCCEEDED donation is never
 *   overwritten by a late "failed" or "expired" event that arrives out of order).
 * - If processing throws, the transaction rolls back (event not recorded) and we
 *   return 500, so Stripe retries later.
 *
 * The database client is passed in so this can be unit tested without Postgres.
 */

/** The small part of the Prisma client this module needs. */
export type WebhookTx = {
  stripeEvent: {
    /** INSERT ... ON CONFLICT DO NOTHING: count is 0 when the event was already recorded. */
    createMany(args: { data: { id: string; type: string }[]; skipDuplicates: true }): Promise<{ count: number }>;
  };
  donation: {
    updateMany(args: {
      where: { id: string; status: { in: DonationStatus[] } };
      data: {
        status?: DonationStatus;
        paidAt?: Date;
        stripePaymentIntentId?: string;
        failureReason?: string | null;
        /** Cleared once no payment page can be open any more (see browser-key.ts). */
        browserKeyHash?: null;
      };
    }): Promise<{ count: number }>;
    findUnique(args: {
      where: { id: string };
      select: { amountCents: true; currency: true };
    }): Promise<{ amountCents: number; currency: string } | null>;
  };
};

export type WebhookDb = {
  $transaction<T>(fn: (tx: WebhookTx) => Promise<T>): Promise<T>;
};

export type WebhookResult =
  | { outcome: "duplicate" }
  | { outcome: "ignored"; reason: string }
  | { outcome: "applied"; donationId: string; status: DonationStatus; changed: boolean };

function idOf(ref: string | { id: string } | null): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref.id;
}

export async function processStripeEvent(db: WebhookDb, event: Stripe.Event): Promise<WebhookResult> {
  return db.$transaction(async (tx) => {
    // Claim the event first. Only a conflict on THIS insert means "already processed"; any other
    // error (including a unique violation on a donation column) rolls back and Stripe retries.
    // A concurrent delivery of the same event waits on the primary key, then inserts nothing.
    const { count } = await tx.stripeEvent.createMany({
      data: [{ id: event.id, type: event.type }],
      skipDuplicates: true,
    });
    if (count === 0) return { outcome: "duplicate" } as const;
    return applyEvent(tx, event);
  });
}

async function applyEvent(tx: WebhookTx, event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const donationId = session.metadata?.donationId;
      if (!donationId) return { outcome: "ignored", reason: "no donationId metadata" };
      if (session.payment_status !== "paid") {
        // Cards settle immediately; anything else is left PENDING for staff to look at.
        return { outcome: "ignored", reason: `payment_status=${session.payment_status}` };
      }

      // Defensive check: Stripe must have charged exactly what we recorded.
      const donation = await tx.donation.findUnique({
        where: { id: donationId },
        select: { amountCents: true, currency: true },
      });
      if (!donation) return { outcome: "ignored", reason: "unknown donation" };
      if (session.amount_total !== donation.amountCents || session.currency?.toUpperCase() !== donation.currency) {
        // Retrying would not fix this, so record the event and leave the donation PENDING for a person to check.
        return {
          outcome: "ignored",
          reason: `amount mismatch: Stripe ${session.amount_total} ${session.currency}, expected ${donation.amountCents} ${donation.currency}`,
        };
      }

      // A FAILED donation can still succeed: Checkout lets the donor retry with another card.
      const { count } = await tx.donation.updateMany({
        where: { id: donationId, status: { in: ["PENDING", "FAILED"] } },
        data: {
          status: "SUCCEEDED",
          paidAt: new Date(event.created * 1000),
          stripePaymentIntentId: idOf(session.payment_intent),
          failureReason: null,
          browserKeyHash: null,
        },
      });
      return { outcome: "applied", donationId, status: "SUCCEEDED", changed: count > 0 };
    }

    case "checkout.session.expired": {
      const donationId = event.data.object.metadata?.donationId;
      if (!donationId) return { outcome: "ignored", reason: "no donationId metadata" };
      // Only PENDING expires. A FAILED donation stays FAILED so staff still see the decline.
      const { count } = await tx.donation.updateMany({
        where: { id: donationId, status: { in: ["PENDING"] } },
        data: { status: "EXPIRED", browserKeyHash: null },
      });
      // The page is closed either way, so the browser link is no longer needed on a FAILED row.
      await tx.donation.updateMany({
        where: { id: donationId, status: { in: ["FAILED"] } },
        data: { browserKeyHash: null },
      });
      return { outcome: "applied", donationId, status: "EXPIRED", changed: count > 0 };
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const donationId = intent.metadata?.donationId;
      if (!donationId) return { outcome: "ignored", reason: "no donationId metadata" };
      const reason = intent.last_payment_error?.message ?? "The payment was declined.";
      // PENDING -> FAILED, or FAILED -> FAILED with the latest reason. Never touches SUCCEEDED.
      const { count } = await tx.donation.updateMany({
        where: { id: donationId, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "FAILED", failureReason: reason.slice(0, 500), stripePaymentIntentId: intent.id },
      });
      return { outcome: "applied", donationId, status: "FAILED", changed: count > 0 };
    }

    default:
      return { outcome: "ignored", reason: `unhandled type ${event.type}` };
  }
}
