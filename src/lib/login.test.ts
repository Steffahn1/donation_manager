import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { canLogIn, type LoginCandidate } from "./login";

const HASH = bcrypt.hashSync("right-password", 4); // low cost: fast tests
const realCompare = (p: string, h: string) => bcrypt.compare(p, h);

/** Records every comparison, to prove the slow check runs in every branch. */
function counting() {
  const calls: string[] = [];
  const compare = async (p: string, h: string) => {
    calls.push(h);
    return realCompare(p, h);
  };
  return { calls, compare };
}

const donor = (over: Partial<NonNullable<LoginCandidate>> = {}): LoginCandidate => ({
  passwordHash: HASH,
  role: "DONOR",
  emailVerifiedAt: new Date("2026-11-01T00:00:00Z"),
  ...over,
});

describe("canLogIn", () => {
  it("lets a confirmed donor and staff in with the right password only", async () => {
    expect(await canLogIn(donor(), "right-password", realCompare)).toBe(true);
    expect(await canLogIn(donor(), "wrong", realCompare)).toBe(false);
    expect(await canLogIn(donor({ role: "SUPER_ADMIN", emailVerifiedAt: null }), "right-password", realCompare)).toBe(true);
  });

  it("never lets in an account without a password: someone who signed up with another person's email", async () => {
    expect(await canLogIn(donor({ passwordHash: null, emailVerifiedAt: null }), "anything", realCompare)).toBe(false);
    expect(await canLogIn(donor({ passwordHash: null, emailVerifiedAt: null }), "", realCompare)).toBe(false);
  });

  it("never lets in an unconfirmed donor, even with a password (e.g. old test rows)", async () => {
    expect(await canLogIn(donor({ emailVerifiedAt: null }), "right-password", realCompare)).toBe(false);
  });

  it("does exactly one slow check whether or not the account exists (no timing difference)", async () => {
    const dummy = counting();
    await canLogIn(null, "guess", dummy.compare);
    expect(dummy.calls).toHaveLength(1);
    const dummyHash = dummy.calls[0];
    expect(dummyHash).toMatch(/^\$2b\$12\$/); // same cost as real passwords

    // No account, or an account without a password: compared against that same cost-12 dummy hash.
    const noPassword = counting();
    await canLogIn(donor({ passwordHash: null, emailVerifiedAt: null }), "guess", noPassword.compare);
    expect(noPassword.calls).toEqual([dummyHash]);

    // A real account: compared once against its own hash.
    const real = counting();
    await canLogIn(donor(), "guess", real.compare);
    expect(real.calls).toEqual([HASH]);
  });
});
