import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { processStripeEvent, type WebhookDb } from "@/lib/stripe-webhook";

/**
 * Stripe webhook endpoint: the ONLY place a donation becomes SUCCEEDED.
 * Local dev: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("whsec_") || secret.includes("...")) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // The signature is computed over the exact raw body, so read it as text (never JSON).
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await processStripeEvent(db as unknown as WebhookDb, event);
    const log = result.outcome === "ignored" ? console.warn : console.info;
    log(`[stripe] ${event.id} ${event.type}: ${JSON.stringify(result)}`);
    return Response.json({ received: true, ...result });
  } catch (e) {
    console.error(`[stripe] failed to process ${event.id} ${event.type}`, e);
    // 500 makes Stripe retry later; nothing was recorded because the transaction rolled back.
    return new Response("Processing failed", { status: 500 });
  }
}
