"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBrowserKeyHash } from "@/lib/browser-key";
import { isAcceptingDonations, notAcceptingReason } from "@/lib/campaigns";
import {
  OPEN_CHECKOUT_WINDOW_MS,
  browserCheckoutsWhere,
  openCheckout,
  type CheckoutDeps,
  type CheckoutOutcome,
  type SessionInfo,
} from "@/lib/checkout-flow";
import { attemptIdSchema, parseDonationDetails, valuesFromForm, type DonateValues, type DonationDetails } from "@/lib/donations";
import {
  classifyCreateError,
  createCheckoutSession,
  errorSummary,
  isCheckoutSessionId,
  isResourceMissing,
  stripe,
} from "@/lib/stripe";
import { generateToken } from "@/lib/tokens";
import { Prisma, type Campaign } from "@/generated/prisma/client";

export type DonateState =
  | { step: "details"; error?: string; values?: DonateValues }
  | { step: "confirm"; values: DonateValues; amountCents: number; attemptId: string; error?: string };

const successUrl = (sessionId: string) => `/donate/success?session_id=${encodeURIComponent(sessionId)}`;

async function loadOpenCampaign(slug: string) {
  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign || campaign.status === "DRAFT") return { error: "This campaign does not exist." } as const;
  if (!isAcceptingDonations(campaign)) return { error: notAcceptingReason(campaign) ?? "This campaign is closed." } as const;
  return { campaign } as const;
}

/**
 * A logged-in donor always gives under their own account email, so the gift
 * shows up in their history. Guests (and staff testing the flow) type any email.
 */
async function enforceAccountEmail(values: DonateValues): Promise<DonateValues> {
  const user = await getCurrentUser();
  return user?.role === "DONOR" ? { ...values, email: user.email } : values;
}

/** Step 1 -> 2: validate the details and show the "please confirm" step. Nothing is stored yet. */
export async function reviewDonation(slug: string, _prev: DonateState, formData: FormData): Promise<DonateState> {
  const values = await enforceAccountEmail(valuesFromForm(formData));
  const parsed = parseDonationDetails(values);
  if (!parsed.success) return { step: "details", error: parsed.error.issues[0].message, values };

  const loaded = await loadOpenCampaign(slug);
  if ("error" in loaded) return { step: "details", error: loaded.error, values };

  // Give this browser its key NOW, before any confirm screen exists, so that two tabs pressing
  // "Confirm and pay" at the same moment send the same key and can see each other's payment page.
  await getBrowserKeyHash();

  return {
    step: "confirm",
    values: { ...values, email: parsed.data.email, name: parsed.data.name },
    amountCents: parsed.data.amountCents,
    // New id per confirm screen: resubmitting this screen reuses it, editing the details makes a new one.
    attemptId: generateToken(),
  };
}

/**
 * The browser key hash links donations made from the same browser, so it is kept only while it is
 * needed to close open payment pages. The webhook clears it when a payment finishes; this clears
 * whatever is left once no page can still be open. Best effort: never blocks a donation.
 */
async function forgetOldBrowserKeys() {
  try {
    await db.donation.updateMany({
      where: { browserKeyHash: { not: null }, createdAt: { lt: new Date(Date.now() - OPEN_CHECKOUT_WINDOW_MS) } },
      data: { browserKeyHash: null },
    });
  } catch (e) {
    console.error("[donate] could not clear old browser keys", errorSummary(e));
  }
}

/** Find (resubmitted confirm screen) or create the PENDING donation for this attempt. */
async function claimDonation(attemptId: string, details: DonationDetails, campaignId: string, browserKeyHash: string) {
  const existing = await db.donation.findUnique({ where: { checkoutAttemptId: attemptId } });
  if (existing) return existing;

  const donor = await db.donor.upsert({
    where: { email: details.email },
    create: { email: details.email, name: details.name },
    update: {}, // never rename an existing donor from a public form; the gift keeps its own name below
  });
  try {
    return await db.donation.create({
      data: {
        donorId: donor.id,
        donorName: details.name,
        campaignId,
        amountCents: details.amountCents,
        isAnonymous: details.anonymous,
        checkoutAttemptId: attemptId,
        browserKeyHash,
      },
    });
  } catch (e) {
    // Two submits raced: the other one created the row first.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    return db.donation.findUniqueOrThrow({ where: { checkoutAttemptId: attemptId } });
  }
}

function toSessionInfo(s: Stripe.Checkout.Session): SessionInfo {
  return { id: s.id, status: s.status, url: s.url };
}

/** Real Stripe + database wiring for the decision logic in checkout-flow.ts. */
function checkoutDeps(
  donation: { id: string; createdAt: Date; amountCents: number; browserKeyHash: string | null },
  ctx: { attemptId: string; campaign: Campaign; donorEmail: string; browserKeyHash: string },
): CheckoutDeps {
  return {
    now: () => new Date(),
    async retrieveSession(id) {
      try {
        return toSessionInfo(await stripe().checkout.sessions.retrieve(id));
      } catch (e) {
        if (isResourceMissing(e)) return null;
        throw e;
      }
    },
    async expireSession(id) {
      await stripe().checkout.sessions.expire(id);
      // The checkout.session.expired webhook then moves that donation PENDING -> EXPIRED.
    },
    async createSession() {
      const session = await createCheckoutSession({
        donationId: donation.id,
        attemptId: ctx.attemptId,
        amountCents: donation.amountCents,
        createdAt: donation.createdAt,
        campaignName: ctx.campaign.name,
        donorEmail: ctx.donorEmail,
      });
      return toSessionInfo(session);
    },
    async saveSessionId(sessionId) {
      await db.donation.update({ where: { id: donation.id }, data: { stripeCheckoutSessionId: sessionId } });
    },
    async findBrowserCheckouts() {
      // The key stored on this donation too, in case the cookie changed since it was created.
      const keys = [ctx.browserKeyHash, ...(donation.browserKeyHash ? [donation.browserKeyHash] : [])];
      const rows = await db.donation.findMany({
        where: browserCheckoutsWhere(keys, ctx.campaign.id, new Date()),
        select: { id: true, createdAt: true, stripeCheckoutSessionId: true },
      });
      return rows.flatMap((r) =>
        r.stripeCheckoutSessionId ? [{ donationId: r.id, createdAt: r.createdAt, sessionId: r.stripeCheckoutSessionId }] : [],
      );
    },
    classifyCreateError,
    onError: (e) => console.error("[donate] checkout problem", { donationId: donation.id, ...errorSummary(e) }),
  };
}

/**
 * Step 2 -> Stripe: create (or reuse) the PENDING donation and its Checkout Session, then redirect.
 * The duplicate-payment rules live in src/lib/checkout-flow.ts.
 */
export async function startCheckout(slug: string, _prev: DonateState, formData: FormData): Promise<DonateState> {
  const values = await enforceAccountEmail(valuesFromForm(formData));
  const parsed = parseDonationDetails(values);
  if (!parsed.success) return { step: "details", error: parsed.error.issues[0].message, values };
  const attempt = attemptIdSchema.safeParse(formData.get("attemptId"));
  if (!attempt.success) return { step: "details", error: "Please review your donation again.", values };
  const attemptId = attempt.data;
  const details = parsed.data;

  const loaded = await loadOpenCampaign(slug);
  if ("error" in loaded) return { step: "details", error: loaded.error, values };
  const { campaign } = loaded;

  let outcome: CheckoutOutcome | { kind: "mismatch" } | { kind: "ended" };
  try {
    await forgetOldBrowserKeys();
    const browserKeyHash = await getBrowserKeyHash();
    const donation = await claimDonation(attemptId, details, campaign.id, browserKeyHash);

    if (donation.status === "SUCCEEDED" && donation.stripeCheckoutSessionId) {
      outcome = { kind: "paid", sessionId: donation.stripeCheckoutSessionId };
    } else if (donation.status === "EXPIRED" || donation.status === "SUCCEEDED") {
      outcome = { kind: "ended" };
    } else if (donation.campaignId !== campaign.id || donation.amountCents !== details.amountCents) {
      // Different details posted with an old attempt id: never reuse a row for a different payment.
      outcome = { kind: "mismatch" };
    } else {
      // PENDING, or FAILED with a payment page that may still be open.
      outcome = await openCheckout(
        checkoutDeps(donation, { attemptId, campaign, donorEmail: details.email, browserKeyHash }),
        donation,
      );
    }
  } catch (e) {
    // Database problem before Stripe was involved: nothing was charged, the same screen can retry.
    console.error("[donate] could not record donation", errorSummary(e));
    outcome = { kind: "retry" };
  }

  // Redirects happen here, outside try/catch, because redirect() works by throwing.
  switch (outcome.kind) {
    // `return` so that a future edit can never fall through into the next case.
    case "redirect":
      return redirect(outcome.url);
    case "paid":
      return redirect(successUrl(outcome.sessionId));
    case "retry":
      return {
        step: "confirm",
        values,
        amountCents: details.amountCents,
        attemptId,
        error: "We could not open the payment page. You have not been charged. Please press the button again.",
      };
    case "superseded":
      return {
        step: "details",
        error: "You started a newer donation in another tab or window. Please finish it there; you have not been charged here.",
        values,
      };
    case "restart":
    case "closed":
    case "ended":
      return {
        step: "details",
        error: "That payment page is no longer available. You have not been charged. Please review your donation and try again.",
        values,
      };
    case "mismatch":
      return { step: "details", error: "Please review your donation again.", values };
  }
}

/**
 * "Try again" after cancelling or a decline: close the old Checkout Session at Stripe
 * (so it can't also be paid in another tab), then send the donor back to the form.
 * The session id comes back from the browser, so it is validated before use.
 */
export async function tryAgain(sessionId: unknown): Promise<void> {
  if (!isCheckoutSessionId(sessionId)) redirect("/campaigns");
  const donation = await db.donation.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: { status: true, campaign: { select: { slug: true } } },
  });
  if (!donation) redirect("/campaigns");
  if (donation.status === "SUCCEEDED") redirect(successUrl(sessionId));

  if (donation.status === "PENDING" || donation.status === "FAILED") {
    let paid = false;
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (session.status === "complete") paid = true;
      else if (session.status === "open") await stripe().checkout.sessions.expire(sessionId);
      // The checkout.session.expired webhook then updates our row (PENDING -> EXPIRED).
    } catch (e) {
      if (!isResourceMissing(e)) console.error("[donate] could not close Checkout Session", errorSummary(e));
    }
    if (paid) redirect(successUrl(sessionId));
  }
  redirect(`/donate/${donation.campaign.slug}?retry=1`);
}
