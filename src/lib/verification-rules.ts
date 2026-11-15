/**
 * Email verification rules (pure or with an injected transaction; tested in verification-rules.test.ts).
 * The real database wiring is in verification.ts.
 *
 * Why the flow looks like this (it prevents "pre-hijacking" an account):
 * - Signup asks for an email address only. The account has no name and NO PASSWORD until the email
 *   is confirmed, so nobody can hold a working password or session for an address they don't own.
 * - The confirm page is where the owner of the inbox chooses their name and password. Confirming also
 *   ends every existing session for the account and links the Donor record with that email (their
 *   earlier guest donations), all in one transaction.
 */

export const VERIFICATION_VALID_HOURS = 24;

/** Raw tokens from generateToken(): 32 random bytes, base64url, 43 characters. */
export function isTokenShaped(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function verificationExpiry(now: Date): Date {
  return new Date(now.getTime() + VERIFICATION_VALID_HOURS * 60 * 60 * 1000);
}

export type TokenCheck = "valid" | "expired" | "unknown";

export function checkVerificationToken(token: { expiresAt: Date } | null, now: Date): TokenCheck {
  if (!token) return "unknown";
  return token.expiresAt > now ? "valid" : "expired";
}

/**
 * What confirming does to the Donor record with the same email, which holds that email's guest
 * donations. Linking happens ONLY on confirmation, after the address is proven.
 */
export type DonorLink =
  | { action: "create" } // no gifts with this email yet: create an empty donor linked to the account
  | { action: "link"; donorId: string } // guest gifts exist: attach them to the account
  | { action: "none" } // already linked to this account
  | { action: "conflict" }; // linked to a different account: never move it

export function donorLinkFor(donor: { id: string; userId: string | null } | null, userId: string): DonorLink {
  if (!donor) return { action: "create" };
  if (donor.userId === null) return { action: "link", donorId: donor.id };
  if (donor.userId === userId) return { action: "none" };
  return { action: "conflict" };
}

/** The database operations confirming needs, all inside one transaction. */
export type ConfirmTx = {
  findToken(tokenHash: string): Promise<{
    expiresAt: Date;
    user: { id: string; email: string; role: "SUPER_ADMIN" | "CAMPAIGN_MANAGER" | "DONOR"; emailVerifiedAt: Date | null };
  } | null>;
  deleteToken(tokenHash: string): Promise<void>;
  /** Deletes the token and returns how many rows were deleted (1 = this request won; 0 = already used). */
  consumeToken(tokenHash: string): Promise<number>;
  deleteUserTokens(userId: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  /** Conditional: only updates an account that is still unconfirmed. Returns rows updated (0 or 1). */
  setAccount(userId: string, data: { name: string; passwordHash: string; emailVerifiedAt: Date }): Promise<number>;
  findDonorByEmail(email: string): Promise<{ id: string; userId: string | null } | null>;
  createDonor(data: { email: string; name: string; userId: string }): Promise<void>;
  /** Must only link if the donor is still unlinked (conditional update). */
  linkDonor(donorId: string, userId: string): Promise<void>;
};

export type ConfirmResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" };

/** How long an unconfirmed signup (no password, no sessions, no donations) is kept: the link's lifetime. */
export const STALE_SIGNUP_HOURS = VERIFICATION_VALID_HOURS;

/**
 * Unconfirmed donor signups that can be deleted: older than the link lifetime and with no link that
 * still works. They have no password, sessions or linked donations, so nothing is lost.
 */
export function staleSignupWhere(now: Date) {
  return {
    role: "DONOR" as const,
    emailVerifiedAt: null,
    passwordHash: null,
    createdAt: { lt: new Date(now.getTime() - STALE_SIGNUP_HOURS * 60 * 60 * 1000) },
    verificationTokens: { none: { expiresAt: { gt: now } } },
  };
}

/** An account that "Add manager" may replace: an unconfirmed, password-less donor signup. */
export function replaceableSignupWhere(email: string) {
  return { email, role: "DONOR" as const, emailVerifiedAt: null, passwordHash: null };
}

export async function confirmAccount(
  tx: ConfirmTx,
  tokenHash: string,
  account: { name: string; passwordHash: string },
  now: Date,
): Promise<ConfirmResult> {
  const token = await tx.findToken(tokenHash);
  const check = checkVerificationToken(token, now);
  if (check === "unknown" || !token) return { ok: false, reason: "invalid" };
  if (check === "expired") {
    await tx.deleteToken(tokenHash);
    return { ok: false, reason: "expired" };
  }
  // Tokens are only issued for unconfirmed donor signups; anything else is treated as invalid.
  const { user } = token;
  if (user.role !== "DONOR" || user.emailVerifiedAt) return { ok: false, reason: "invalid" };

  // Use the link up FIRST, as a conditional write: of two simultaneous submissions with the same link,
  // the second waits on the first's delete and then deletes nothing, so it stops here.
  if ((await tx.consumeToken(tokenHash)) !== 1) return { ok: false, reason: "invalid" };
  if ((await tx.setAccount(user.id, { ...account, emailVerifiedAt: now })) !== 1) return { ok: false, reason: "invalid" };
  await tx.deleteUserTokens(user.id); // every other link for this account stops working too
  await tx.deleteUserSessions(user.id); // nobody stays logged in from before the owner confirmed

  const link = donorLinkFor(await tx.findDonorByEmail(user.email), user.id);
  if (link.action === "create") await tx.createDonor({ email: user.email, name: account.name, userId: user.id });
  else if (link.action === "link") await tx.linkDonor(link.donorId, user.id);
  // "none": already linked. "conflict": impossible (emails are unique per account); never move it.
  return { ok: true, userId: user.id };
}
