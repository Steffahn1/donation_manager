import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { DonorDonationRow } from "@/lib/donor-summary";
import { raisedByCampaign } from "./campaigns";

/**
 * A donor's own donations. Only through Donor.userId, which is set when the email is verified, so an
 * unverified account sees nothing (it could have been created with someone else's email).
 */
export async function getDonorDonations(user: CurrentUser) {
  if (user.role !== "DONOR" || !user.emailVerified) return null;
  const donor = await db.donor.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!donor) return { rows: [] as DonorDonationRow[], raised: () => ({ raisedCents: 0, donationCount: 0 }) };

  const found = await db.donation.findMany({
    where: { donorId: donor.id },
    select: {
      id: true,
      amountCents: true,
      status: true,
      isAnonymous: true,
      donorName: true,
      createdAt: true,
      paidAt: true,
      stripeCheckoutSessionId: true,
      campaign: {
        select: { id: true, name: true, slug: true, targetCents: true, impactAmountCents: true, impactLabel: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  // The session id itself isn't needed by the page; keep only whether one exists.
  const rows: DonorDonationRow[] = found.map(({ stripeCheckoutSessionId, ...r }) => ({
    ...r,
    hasCheckout: stripeCheckoutSessionId !== null,
  }));
  const raised = await raisedByCampaign([...new Set(rows.map((r) => r.campaign.id))]);
  return { rows, raised };
}
