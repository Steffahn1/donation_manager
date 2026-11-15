"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revealOwnGift } from "@/lib/reveal";

export type RevealState = { error?: string } | undefined;

/**
 * Reveal the donor's name on one of their own paid anonymous gifts. Permanent: there is no action
 * that makes a gift anonymous again (staff may already have seen the name). See src/lib/reveal.ts.
 */
export async function revealDonation(_prev: RevealState, formData: FormData): Promise<RevealState> {
  const user = await requireRole("DONOR");
  const result = await revealOwnGift(
    async (where, data) => (await db.donation.updateMany({ where, data })).count,
    user,
    formData.get("donationId"),
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard");
  return undefined;
}
