import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import type { DonationStatus } from "@/generated/prisma/client";
import { processStripeEvent, type WebhookDb, type WebhookTx } from "./stripe-webhook";

type Row = {
  id: string;
  amountCents: number;
  currency: string;
  status: DonationStatus;
  paidAt: Date | null;
  stripePaymentIntentId: string | null;
  failureReason: string | null;
};

/**
 * Minimal in-memory stand-in for the Prisma client. $transaction snapshots state and
 * restores it on error, like a real rollback; a duplicate event id throws P2002.
 */
function fakeDb(rows: Row[]) {
  const state = { events: new Map<string, string>(), donations: new Map(rows.map((r) => [r.id, { ...r }])) };

  const tx: WebhookTx = {
    stripeEvent: {
      async create({ data }) {
        if (state.events.has(data.id)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        state.events.set(data.id, data.type);
        return data;
      },
    },
    donation: {
      async findUnique({ where }) {
        const r = state.donations.get(where.id);
        return r ? { amountCents: r.amountCents, currency: r.currency } : null;
      },
      async updateMany({ where, data }) {
        const r = state.donations.get(where.id);
        if (!r || !where.status.in.includes(r.status)) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
    },
  };

  const db: WebhookDb = {
    async $transaction(fn) {
      const snapshot = {
        events: new Map(state.events),
        donations: new Map([...state.donations].map(([k, v]) => [k, { ...v }])),
      };
      try {
        return await fn(tx);
      } catch (e) {
        state.events = snapshot.events;
        state.donations = snapshot.donations;
        throw e;
      }
    },
  };
  return { db, state, row: (id: string) => state.donations.get(id)! };
}

const pending = (id = "don_1", amountCents = 50000): Row => ({
  id,
  amountCents,
  currency: "ZAR",
  status: "PENDING",
  paidAt: null,
  stripePaymentIntentId: null,
  failureReason: null,
});

let seq = 0;
function completed(donationId: string, opts: { amount?: number; paid?: boolean; eventId?: string } = {}) {
  return {
    id: opts.eventId ?? `evt_${++seq}`,
    type: "checkout.session.completed",
    created: 1_763_000_000,
    data: {
      object: {
        id: "cs_test_1",
        metadata: { donationId },
        payment_status: opts.paid === false ? "unpaid" : "paid",
        amount_total: opts.amount ?? 50000,
        currency: "zar",
        payment_intent: "pi_1",
      },
    },
  } as unknown as Stripe.Event;
}

function expired(donationId: string) {
  return {
    id: `evt_${++seq}`,
    type: "checkout.session.expired",
    created: 1_763_000_000,
    data: { object: { id: "cs_test_1", metadata: { donationId } } },
  } as unknown as Stripe.Event;
}

function failed(donationId: string, message = "Your card was declined.") {
  return {
    id: `evt_${++seq}`,
    type: "payment_intent.payment_failed",
    created: 1_763_000_000,
    data: { object: { id: "pi_1", metadata: { donationId }, last_payment_error: { message } } },
  } as unknown as Stripe.Event;
}

describe("processStripeEvent", () => {
  it("marks a pending donation as succeeded when checkout completes", async () => {
    const { db, row } = fakeDb([pending()]);
    const result = await processStripeEvent(db, completed("don_1"));
    expect(result).toEqual({ outcome: "applied", donationId: "don_1", status: "SUCCEEDED", changed: true });
    expect(row("don_1").status).toBe("SUCCEEDED");
    expect(row("don_1").paidAt).toEqual(new Date(1_763_000_000 * 1000));
    expect(row("don_1").stripePaymentIntentId).toBe("pi_1");
  });

  it("ignores a replayed event (same event id) so nothing is counted twice", async () => {
    const { db, state } = fakeDb([pending()]);
    const event = completed("don_1", { eventId: "evt_replay" });
    await processStripeEvent(db, event);
    const again = await processStripeEvent(db, event);
    expect(again).toEqual({ outcome: "duplicate" });
    expect(state.events.size).toBe(1);
  });

  it("lets a decline be followed by a successful retry on the same checkout page", async () => {
    const { db, row } = fakeDb([pending()]);
    await processStripeEvent(db, failed("don_1"));
    expect(row("don_1").status).toBe("FAILED");
    expect(row("don_1").failureReason).toBe("Your card was declined.");

    await processStripeEvent(db, completed("don_1"));
    expect(row("don_1").status).toBe("SUCCEEDED");
    expect(row("don_1").failureReason).toBeNull();
  });

  it("never downgrades a succeeded donation when late events arrive out of order", async () => {
    const { db, row } = fakeDb([pending()]);
    await processStripeEvent(db, completed("don_1"));
    const lateFail = await processStripeEvent(db, failed("don_1"));
    const lateExpire = await processStripeEvent(db, expired("don_1"));
    expect(lateFail).toMatchObject({ changed: false });
    expect(lateExpire).toMatchObject({ changed: false });
    expect(row("don_1").status).toBe("SUCCEEDED");
  });

  it("expires only pending donations; a declined one stays FAILED for staff to see", async () => {
    const { db, row } = fakeDb([pending("a"), pending("b")]);
    await processStripeEvent(db, expired("a"));
    await processStripeEvent(db, failed("b"));
    await processStripeEvent(db, expired("b"));
    expect(row("a").status).toBe("EXPIRED");
    expect(row("b").status).toBe("FAILED");
  });

  it("does not mark paid when the charged amount differs from the donation", async () => {
    const { db, row } = fakeDb([pending("don_1", 50000)]);
    const result = await processStripeEvent(db, completed("don_1", { amount: 100 }));
    expect(result.outcome).toBe("ignored");
    expect(row("don_1").status).toBe("PENDING");
  });

  it("does not mark paid when the session is not paid", async () => {
    const { db, row } = fakeDb([pending()]);
    const result = await processStripeEvent(db, completed("don_1", { paid: false }));
    expect(result.outcome).toBe("ignored");
    expect(row("don_1").status).toBe("PENDING");
  });

  it("records but ignores event types we don't handle", async () => {
    const { db, state } = fakeDb([]);
    const event = { id: "evt_other", type: "charge.refunded", data: { object: {} } } as unknown as Stripe.Event;
    expect((await processStripeEvent(db, event)).outcome).toBe("ignored");
    expect(state.events.has("evt_other")).toBe(true);
  });

  it("rolls back the event record when processing throws, so Stripe can retry", async () => {
    const { db, state } = fakeDb([pending()]);
    const broken: WebhookDb = {
      $transaction: (fn) =>
        db.$transaction((tx) =>
          fn({
            ...tx,
            donation: {
              ...tx.donation,
              updateMany: async () => {
                throw new Error("db down");
              },
            },
          }),
        ),
    };
    await expect(processStripeEvent(broken, completed("don_1", { eventId: "evt_retry" }))).rejects.toThrow("db down");
    expect(state.events.has("evt_retry")).toBe(false);
    // The retry then succeeds normally.
    expect((await processStripeEvent(db, completed("don_1", { eventId: "evt_retry" }))).outcome).toBe("applied");
  });
});
