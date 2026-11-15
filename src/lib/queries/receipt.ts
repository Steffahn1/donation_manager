import "server-only";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { isTokenShaped } from "@/lib/verification-rules";
import { raisedByCampaign } from "./campaigns";

/** The donation behind a private receipt link, looked up by the token's hash (raw tokens aren't stored). */
export async function getReceipt(token: unknown) {
  if (!isTokenShaped(token)) return null;
  const d = await db.donation.findUnique({
    where: { receiptTokenHash: hashToken(token) },
    select: {
      amountCents: true,
      status: true,
      paidAt: true,
      createdAt: true,
      donorName: true,
      isAnonymous: true,
      campaign: {
        select: { id: true, name: true, slug: true, targetCents: true, impactAmountCents: true, impactLabel: true },
      },
    },
  });
  if (!d) return null;
  const raised = await raisedByCampaign([d.campaign.id]);
  return { ...d, campaignRaised: raised(d.campaign.id) };
}
