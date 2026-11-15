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

  it("does the same slow check whether or not the account exists (no timing difference)", async () => {
    for (const user of [null, donor({ passwordHash: null, emailVerifiedAt: null }), donor()]) {
      const c = counting();
      await canLogIn(user, "guess", c.compare);
      expect(c.calls).toHaveLength(1);
      expect(c.calls[0]).toMatch(/^\$2[aby]\$12\$|^\$2[aby]\$04\$/);
    }
    const missing = counting();
    await canLogIn(null, "guess", missing.compare);
    expect(missing.calls[0]).toMatch(/^\$2b\$12\$/); // the dummy uses the same cost as real passwords
  });
});
