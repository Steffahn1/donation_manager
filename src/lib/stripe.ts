import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily created so a missing key only fails when payments are actually used. */
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_")) {
    // This project is a demo: refuse to run against live keys.
    throw new Error("STRIPE_SECRET_KEY must be set to a Stripe TEST mode key (sk_test_...).");
  }
  client = new Stripe(key);
  return client;
}

/**
 * A TEST-mode Checkout Session id as it arrives from the browser or a URL (bound action
 * arguments and query strings are NOT trusted). Live ids are rejected: live keys are refused.
 */
export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && /^cs_test_[A-Za-z0-9]{10,250}$/.test(value);
}

/** True when Stripe says the object doesn't exist (e.g. test data deleted, or a different account key). */
export function isResourceMissing(e: unknown): boolean {
  return e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "resource_missing";
}

/**
 * After a failed "create Checkout Session" call: can the donor press the same button again?
 * Only if the request never reached Stripe (connection error) or the failure was ours. Any answer
 * Stripe gave (including a 500) is replayed for the same idempotency key for 24 hours.
 */
export function classifyCreateError(e: unknown): "retry" | "restart" {
  if (e instanceof Stripe.errors.StripeConnectionError) return "retry";
  // Not stored against the idempotency key, so pressing again can work:
  // 429 rate limit, and 409 "the same request is still running" (e.g. a duplicated tab).
  if (e instanceof Stripe.errors.StripeRateLimitError) return "retry";
  if (e instanceof Stripe.errors.StripeError && e.code === "idempotency_key_in_use") return "retry";
  if (e instanceof Stripe.errors.StripeError) return "restart";
  return "retry";
}

/**
 * Safe-to-log summary of an error from Stripe or the database. Never logs the message:
 * Stripe echoes rejected parameter values (e.g. an email address) back in it.
 */
export function errorSummary(e: unknown): Record<string, string | number | undefined> {
  if (e instanceof Stripe.errors.StripeError) {
    return { source: "stripe", type: e.type, code: e.code, statusCode: e.statusCode, requestId: e.requestId };
  }
  if (e instanceof Error) {
    return { source: "app", name: e.name, code: (e as { code?: string }).code };
  }
  return { source: "unknown" };
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Checkout sessions expire 60 minutes after the donation row was created, so an
 * abandoned payment page can't be paid hours later. Derived from the row (not
 * "now") so a retried create call sends identical parameters, which Stripe
 * requires when reusing an idempotency key. Stripe's minimum is 30 minutes.
 */
const CHECKOUT_TTL_SECONDS = 60 * 60;

export type CheckoutInput = {
  donationId: string;
  attemptId: string;
  amountCents: number;
  createdAt: Date;
  campaignName: string;
  donorEmail: string;
};

/**
 * Creates a hosted Checkout Session for one donation.
 * The idempotency key is tied to the confirm-step attempt, so a double-submitted
 * form (or a retried network request) gets the same session back from Stripe
 * instead of a second one.
 */
export async function createCheckoutSession(input: CheckoutInput): Promise<Stripe.Checkout.Session> {
  const base = appUrl();
  const metadata = { donationId: input.donationId };
  return stripe().checkout.sessions.create(
    {
      mode: "payment",
      allowed_payment_method_types: ["card"], // cards settle immediately, so "completed" means "paid"
      customer_email: input.donorEmail,
      client_reference_id: input.donationId,
      metadata,
      payment_intent_data: { metadata, description: `Donation to ${input.campaignName}` },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "zar",
            unit_amount: input.amountCents,
            product_data: { name: `Donation to ${input.campaignName}` },
          },
        },
      ],
      expires_at: Math.floor(input.createdAt.getTime() / 1000) + CHECKOUT_TTL_SECONDS,
      success_url: `${base}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/donate/cancelled?session_id={CHECKOUT_SESSION_ID}`,
    },
    { idempotencyKey: `checkout-${input.attemptId}` },
  );
}
