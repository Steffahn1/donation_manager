"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAcceptingDonations, notAcceptingReason } from "@/lib/campaigns";
import { attemptIdSchema, parseDonationDetails, valuesFromForm, type DonateValues } from "@/lib/donations";
import { createCheckoutSession, stripe } from "@/lib/stripe";
import { generateToken } from "@/lib/tokens";
import { Prisma } from "@/generated/prisma/client";

export type DonateState =
  | { step: "details"; error?: string; values?: DonateValues }
  | { step: "confirm"; values: DonateValues; amountCents: number; attemptId: string; error?: string };

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

  return {
    step: "confirm",
    values: { ...values, email: parsed.data.email, name: parsed.data.name },
    amountCents: parsed.data.amountCents,
    // New id per confirm screen: resubmitting this screen reuses it, editing the details makes a new one.
    attemptId: generateToken(),
  };
}

/**
 * Step 2 -> Stripe: create the PENDING donation and a Checkout Session, then redirect.
 *
 * Duplicate protection: the attempt id is unique on the donation and is the Stripe
 * idempotency key, so a double click / resubmit of the same confirm screen sends the
 * donor to the SAME checkout session instead of creating a second payment.
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

  // Resubmitted confirm screen: reuse what the first submit created.
  let donation = await db.donation.findUnique({ where: { checkoutAttemptId: attemptId } });
  if (!donation) {
    const donor = await db.donor.upsert({
      where: { email: details.email },
      create: { email: details.email, name: details.name },
      update: {}, // keep the name on file; a guest form must not rename an existing donor
    });
    try {
      donation = await db.donation.create({
        data: {
          donorId: donor.id,
          campaignId: campaign.id,
          amountCents: details.amountCents,
          isAnonymous: details.anonymous,
          checkoutAttemptId: attemptId,
          receiptToken: generateToken(),
        },
      });
    } catch (e) {
      // Two submits raced: the other one created the row first.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      donation = await db.donation.findUniqueOrThrow({ where: { checkoutAttemptId: attemptId } });
    }
  }

  if (donation.status === "SUCCEEDED") {
    redirect(`/donate/success?session_id=${encodeURIComponent(donation.stripeCheckoutSessionId ?? "")}`);
  }
  if (donation.status !== "PENDING") {
    return { step: "details", error: "That payment attempt has ended. Please review your donation and try again.", values };
  }
  // Different details posted with an old attempt id: never reuse a row for a different payment.
  if (donation.campaignId !== campaign.id || donation.amountCents !== details.amountCents) {
    return { step: "details", error: "Please review your donation again.", values };
  }

  let checkoutUrl: string | null;
  try {
    // Resubmit after the session was stored: fetch it rather than creating it again.
    const session = donation.stripeCheckoutSessionId
      ? await stripe().checkout.sessions.retrieve(donation.stripeCheckoutSessionId)
      : await createCheckoutSession({
          donationId: donation.id,
          attemptId,
          amountCents: donation.amountCents,
          createdAt: donation.createdAt,
          campaignName: campaign.name,
          donorEmail: details.email,
        });
    if (donation.stripeCheckoutSessionId !== session.id) {
      await db.donation.update({ where: { id: donation.id }, data: { stripeCheckoutSessionId: session.id } });
    }
    checkoutUrl = session.status === "open" ? session.url : null;
  } catch (e) {
    console.error("[donate] could not create Stripe Checkout Session", e);
    await db.donation.updateMany({
      where: { id: donation.id, status: "PENDING", stripeCheckoutSessionId: null },
      data: { status: "FAILED", failureReason: "Could not connect to the payment provider." },
    });
    return {
      step: "details",
      error: "We could not connect to the payment provider. You have not been charged. Please try again in a moment.",
      values,
    };
  }

  if (!checkoutUrl) {
    return { step: "details", error: "That payment page has closed. Please review your donation and try again.", values };
  }
  redirect(checkoutUrl); // outside try/catch: redirect() works by throwing
}

/**
 * "Try again" after cancelling or a decline: close the old Checkout Session at Stripe
 * (so it can't also be paid in another tab), then send the donor back to the form.
 */
export async function tryAgain(sessionId: string): Promise<void> {
  const donation = await db.donation.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: { status: true, campaign: { select: { slug: true } } },
  });
  if (!donation) redirect("/campaigns");
  if (donation.status === "SUCCEEDED") redirect(`/donate/success?session_id=${encodeURIComponent(sessionId)}`);

  if (donation.status === "PENDING" || donation.status === "FAILED") {
    try {
      await stripe().checkout.sessions.expire(sessionId);
      // The checkout.session.expired webhook updates our row (PENDING -> EXPIRED).
    } catch {
      // Already expired or completed: nothing to close. A completed payment still arrives via webhook.
    }
  }
  redirect(`/donate/${donation.campaign.slug}?retry=1`);
}
