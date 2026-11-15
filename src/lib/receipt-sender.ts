import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { sendReceiptOnce, type ReceiptDeps, type ReceiptOutcome } from "./receipts";
import { appUrl, errorSummary } from "./stripe";
import { generateToken, hashToken } from "./tokens";

const deps: ReceiptDeps = {
  newToken: generateToken,
  hash: hashToken,
  async load(donationId) {
    const d = await db.donation.findFirst({
      where: { id: donationId, status: "SUCCEEDED", paidAt: { not: null } },
      select: {
        amountCents: true,
        paidAt: true,
        isAnonymous: true,
        donorName: true,
        donor: { select: { email: true } },
        campaign: { select: { name: true } },
      },
    });
    if (!d?.paidAt) return null;
    return {
      email: d.donor.email,
      name: d.donorName,
      amountCents: d.amountCents,
      campaignName: d.campaign.name,
      paidAt: d.paidAt,
      isAnonymous: d.isAnonymous,
    };
  },
  async claim(donationId, tokenHash) {
    const { count } = await db.donation.updateMany({
      where: { id: donationId, status: "SUCCEEDED", receiptTokenHash: null },
      data: { receiptTokenHash: tokenHash },
    });
    return count === 1;
  },
  send: (to, content) => sendEmail(to, content, "receipt"),
  appUrl: appUrl(),
};

/** Never throws: a receipt problem must not affect the payment or the webhook. Logs ids only. */
export async function sendReceipt(donationId: string): Promise<ReceiptOutcome | "error"> {
  try {
    const outcome = await sendReceiptOnce(deps, donationId);
    if (outcome !== "sent") console.warn(`[receipt] ${donationId}: ${outcome}`);
    return outcome;
  } catch (e) {
    console.error(`[receipt] ${donationId}: failed`, errorSummary(e));
    return "error";
  }
}
