import "server-only";
import { db } from "./db";
import { hashPassword } from "./auth";
import { sendEmail } from "./email";
import { verificationEmail } from "./email-templates";
import { appUrl, errorSummary } from "./stripe";
import { generateToken, hashToken } from "./tokens";
import { Prisma } from "@/generated/prisma/client";
import {
  VERIFICATION_VALID_HOURS,
  confirmAccount,
  isTokenShaped,
  staleSignupWhere,
  verificationExpiry,
  type ConfirmResult,
  type ConfirmTx,
} from "./verification-rules";

/**
 * Handles a donor signup for an email address. Runs AFTER the response (see signup()), so whether the
 * address already has an account can't be read from the response or its timing. Never throws.
 * - new address: create an unconfirmed donor account (no name, no password) and email a link
 * - unconfirmed donor account: email a fresh link (earlier links stop working)
 * - anything else (confirmed donor, staff): do nothing
 */
export async function handleSignup(email: string): Promise<void> {
  await deleteStaleSignups();
  try {
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      try {
        user = await db.user.create({ data: { email, name: "", passwordHash: null, role: "DONOR" } });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        user = await db.user.findUnique({ where: { email } }); // a concurrent signup created it
      }
    }
    if (user && user.role === "DONOR" && !user.emailVerifiedAt) await issueVerification(user);
  } catch (e) {
    console.error("[signup] could not process signup", errorSummary(e));
  }
}

/**
 * Replaces any earlier links for this account with a new one and emails it. The account row is locked
 * first, so two signups for the same email at the same moment run one after the other and only the
 * last link stays valid.
 */
async function issueVerification(user: { id: string; email: string }): Promise<boolean> {
  const token = generateToken();
  const issued = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    if (locked.length !== 1) return false; // deleted in the meantime (e.g. replaced by "Add manager")
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await tx.emailVerificationToken.create({
      data: { id: hashToken(token), userId: user.id, expiresAt: verificationExpiry(new Date()) },
    });
    return true;
  });
  if (!issued) return false;
  const verifyUrl = `${appUrl()}/verify-email?token=${token}`;
  return sendEmail(user.email, verificationEmail({ verifyUrl, validHours: VERIFICATION_VALID_HOURS }), "verification");
}

/**
 * Removes unconfirmed signups whose links have expired (no password, sessions or donations, so nothing
 * is lost), so they don't pile up or block an email address. Best effort; runs after signups.
 */
export async function deleteStaleSignups(): Promise<void> {
  try {
    await db.user.deleteMany({ where: staleSignupWhere(new Date()) });
  } catch (e) {
    console.error("[signup] could not remove stale signups", errorSummary(e));
  }
}

/** Confirms the email with the token from the link and sets the account's name and password. */
export async function confirmVerification(
  rawToken: unknown,
  account: { name: string; password: string },
): Promise<ConfirmResult | { ok: false; reason: "error" }> {
  if (!isTokenShaped(rawToken)) return { ok: false, reason: "invalid" };
  try {
    const passwordHash = await hashPassword(account.password);
    return await db.$transaction((t) => {
      const tx: ConfirmTx = {
        findToken: (id) =>
          t.emailVerificationToken.findUnique({
            where: { id },
            select: { expiresAt: true, user: { select: { id: true, email: true, role: true, emailVerifiedAt: true } } },
          }),
        deleteToken: async (id) => void (await t.emailVerificationToken.deleteMany({ where: { id } })),
        lockUser: async (userId) =>
          (await t.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`).length === 1,
        consumeToken: async (id) => (await t.emailVerificationToken.deleteMany({ where: { id } })).count,
        deleteUserTokens: async (userId) => void (await t.emailVerificationToken.deleteMany({ where: { userId } })),
        deleteUserSessions: async (userId) => void (await t.session.deleteMany({ where: { userId } })),
        setAccount: async (userId, data) =>
          (await t.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data })).count,
        findDonorByEmail: (email) => t.donor.findUnique({ where: { email }, select: { id: true, userId: true } }),
        createDonor: async (data) => void (await t.donor.create({ data })),
        linkDonor: async (donorId, userId) =>
          void (await t.donor.updateMany({ where: { id: donorId, userId: null }, data: { userId } })),
      };
      return confirmAccount(tx, hashToken(rawToken), { name: account.name, passwordHash }, new Date());
    });
  } catch (e) {
    console.error("[verify] could not confirm email", errorSummary(e));
    return { ok: false, reason: "error" };
  }
}
