import bcrypt from "bcryptjs";

/**
 * Login decision (tested in login.test.ts). Two rules:
 * - Same answer AND same work for every email: the slow bcrypt comparison always runs (against a
 *   dummy hash when there is no account or no password), so timing doesn't reveal which emails
 *   have accounts.
 * - An account without a password, or a donor who hasn't confirmed their email, can never log in.
 *   This is what stops someone who signed up with another person's email from getting in.
 */

/** bcrypt hash (cost 12, same as real passwords) of a random value nobody knows. */
const DUMMY_HASH = "$2b$12$Fhn34T1sYm8i9l0/Gmfz6uO31swmpCvFNzulzapYylzyxDfUKv4xy";

export type LoginCandidate = {
  passwordHash: string | null;
  role: "SUPER_ADMIN" | "CAMPAIGN_MANAGER" | "DONOR";
  emailVerifiedAt: Date | null;
} | null;

export async function canLogIn(
  user: LoginCandidate,
  password: string,
  compare: (password: string, hash: string) => Promise<boolean> = bcrypt.compare,
): Promise<boolean> {
  const matches = await compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash) return false;
  if (user.role === "DONOR" && !user.emailVerifiedAt) return false;
  return matches;
}
