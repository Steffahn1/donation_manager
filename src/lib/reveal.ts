import { z } from "zod";
import { REVEAL_DATA, revealWhere } from "./donor-summary";

/**
 * "Show my name" on an anonymous gift (decision logic; the database update is injected so this is
 * tested in reveal.test.ts, and wired to Prisma in src/app/actions/donor.ts).
 */

type RevealUpdate = (
  where: ReturnType<typeof revealWhere>,
  data: typeof REVEAL_DATA,
) => Promise<number>; // number of donations changed

const donationIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+$/);

export type RevealResult = { ok: true } | { ok: false; error: string };

export async function revealOwnGift(
  update: RevealUpdate,
  user: { id: string; role: string; emailVerified: boolean },
  rawDonationId: unknown,
): Promise<RevealResult> {
  if (user.role !== "DONOR") return { ok: false, error: "Only donors can change their donations." };
  if (!user.emailVerified) return { ok: false, error: "Please confirm your email address first." };
  const id = donationIdSchema.safeParse(rawDonationId);
  if (!id.success) return { ok: false, error: "This donation can't be changed." };

  const changed = await update(revealWhere(id.data, user.id), REVEAL_DATA);
  return changed === 1 ? { ok: true } : { ok: false, error: "This donation can't be changed." };
}
