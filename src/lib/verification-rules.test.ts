import { describe, expect, it } from "vitest";
import {
  STALE_SIGNUP_HOURS,
  confirmAccount,
  replaceableSignupWhere,
  staleSignupWhere,
  VERIFICATION_VALID_HOURS,
  checkVerificationToken,
  donorLinkFor,
  isTokenShaped,
  verificationExpiry,
} from "./verification-rules";

const NOW = new Date("2026-11-14T10:00:00Z");

describe("verification tokens", () => {
  it("expire after 24 hours", () => {
    expect(VERIFICATION_VALID_HOURS).toBe(24);
    expect(verificationExpiry(NOW).toISOString()).toBe("2026-11-15T10:00:00.000Z");
  });

  it("are valid until the expiry moment, then expired; an unknown token is unknown", () => {
    const token = { expiresAt: verificationExpiry(NOW) };
    expect(checkVerificationToken(token, new Date("2026-11-15T09:59:59Z"))).toBe("valid");
    expect(checkVerificationToken(token, new Date("2026-11-15T10:00:00Z"))).toBe("expired");
    expect(checkVerificationToken(null, NOW)).toBe("unknown");
  });

  it("only accepts the shape generateToken() produces", () => {
    expect(isTokenShaped("A".repeat(43))).toBe(true);
    expect(isTokenShaped("a-b_c".padEnd(43, "x"))).toBe(true);
    expect(isTokenShaped("A".repeat(42))).toBe(false);
    expect(isTokenShaped("A".repeat(42) + "=")).toBe(false);
    expect(isTokenShaped(["A".repeat(43)])).toBe(false);
    expect(isTokenShaped(undefined)).toBe(false);
  });
});

describe("donorLinkFor: linking guest donations only after the email is verified", () => {
  it("links an unclaimed donor record (guest donations with this email) to the account", () => {
    expect(donorLinkFor({ id: "donor_1", userId: null }, "user_1")).toEqual({ action: "link", donorId: "donor_1" });
  });

  it("creates a donor record when there are no donations with this email yet", () => {
    expect(donorLinkFor(null, "user_1")).toEqual({ action: "create" });
  });

  it("does nothing when already linked to this account", () => {
    expect(donorLinkFor({ id: "donor_1", userId: "user_1" }, "user_1")).toEqual({ action: "none" });
  });

  it("never moves a donor record that belongs to another account", () => {
    expect(donorLinkFor({ id: "donor_1", userId: "user_2" }, "user_1")).toEqual({ action: "conflict" });
  });
});

describe("confirmAccount (the confirm page)", () => {
  type User = { id: string; email: string; role: "SUPER_ADMIN" | "CAMPAIGN_MANAGER" | "DONOR"; emailVerifiedAt: Date | null; name: string; passwordHash: string | null };

  /** In-memory accounts, tokens, sessions and donors behind the ConfirmTx interface. */
  function world(opts: {
    user?: Partial<User>;
    tokenExpiresAt?: Date;
    donor?: { id: string; userId: string | null } | null;
    userDeleted?: boolean;
  }) {
    const user: User = { id: "u1", email: "victim@example.test", role: "DONOR", emailVerifiedAt: null, name: "", passwordHash: null, ...opts.user };
    const tokens = new Map([["hash_ok", { userId: user.id, expiresAt: opts.tokenExpiresAt ?? verificationExpiry(NOW) }], ["hash_other", { userId: user.id, expiresAt: verificationExpiry(NOW) }]]);
    const sessions = new Set(["attacker_session", "old_session"]); // all belong to u1
    const calls: string[] = [];
    const userDeleted = opts.userDeleted ?? false;
    const donors = new Map<string, { id: string; email: string; name: string; userId: string | null }>();
    if (opts.donor !== null) {
      const d = opts.donor ?? { id: "donor_1", userId: null };
      donors.set(d.id, { ...d, email: user.email, name: "Guest Name" });
    }
    const tx = {
      findToken: async (h: string) => {
        const t = tokens.get(h);
        return t ? { expiresAt: t.expiresAt, user: { id: user.id, email: user.email, role: user.role, emailVerifiedAt: user.emailVerifiedAt } } : null;
      },
      deleteToken: async (h: string) => void tokens.delete(h),
      lockUser: async () => {
        calls.push("lockUser");
        return !userDeleted;
      },
      consumeToken: async (h: string) => {
        calls.push("consumeToken");
        return tokens.delete(h) ? 1 : 0;
      },
      deleteUserTokens: async () => tokens.clear(),
      deleteUserSessions: async () => sessions.clear(),
      setAccount: async (_id: string, data: { name: string; passwordHash: string; emailVerifiedAt: Date }) => {
        if (user.emailVerifiedAt) return 0; // conditional update: only while unconfirmed
        Object.assign(user, data);
        return 1;
      },
      findDonorByEmail: async (email: string) => [...donors.values()].find((d) => d.email === email) ?? null,
      createDonor: async (d: { email: string; name: string; userId: string }) => void donors.set("donor_new", { id: "donor_new", ...d }),
      linkDonor: async (donorId: string, userId: string) => {
        const d = donors.get(donorId);
        if (d && d.userId === null) d.userId = userId;
      },
    };
    return { tx, user, tokens, sessions, donors, calls };
  }
  const account = { name: "Real Owner", passwordHash: "hash(owner-password)" };

  it("account created by someone else: the inbox owner sets the password and every earlier session ends", async () => {
    // An attacker signed up with the victim's email and somehow holds a session for that account.
    // Confirming (which only the inbox owner can do) sets THEIR password and ends all other sessions,
    // so the attacker ends up with neither a password nor a session.
    const w = world({});
    expect(await confirmAccount(w.tx, "hash_ok", account, NOW)).toEqual({ ok: true, userId: "u1" });
    expect(w.user).toMatchObject({ name: "Real Owner", passwordHash: "hash(owner-password)", emailVerifiedAt: NOW });
    expect(w.sessions.size).toBe(0);
  });

  it("links the guest donations with this email, and only now", async () => {
    const w = world({});
    await confirmAccount(w.tx, "hash_ok", account, NOW);
    expect(w.donors.get("donor_1")!.userId).toBe("u1");
  });

  it("creates an empty donor record if there were no donations with this email", async () => {
    const w = world({ donor: null });
    await confirmAccount(w.tx, "hash_ok", account, NOW);
    expect(w.donors.get("donor_new")).toMatchObject({ email: "victim@example.test", name: "Real Owner", userId: "u1" });
  });

  it("never moves a donor record that belongs to another account", async () => {
    const w = world({ donor: { id: "donor_1", userId: "u_other" } });
    await confirmAccount(w.tx, "hash_ok", account, NOW);
    expect(w.donors.get("donor_1")!.userId).toBe("u_other");
  });

  it("works once: all of the account's links stop working", async () => {
    const w = world({});
    await confirmAccount(w.tx, "hash_ok", account, NOW);
    expect(w.tokens.size).toBe(0);
    expect(await confirmAccount(w.tx, "hash_ok", account, NOW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("two submissions of the same link at the same moment: only one confirms", async () => {
    // Both read the token before either writes; the database then lets only one delete it.
    const w = world({});
    const realFind = w.tx.findToken;
    let release!: () => void;
    const bothRead = new Promise<void>((r) => (release = r));
    let reads = 0;
    w.tx.findToken = async (h: string) => {
      const t = await realFind(h);
      if (++reads === 2) release();
      await bothRead;
      return t;
    };
    const results = await Promise.all([
      confirmAccount(w.tx, "hash_ok", { name: "First", passwordHash: "hash(first)" }, NOW),
      confirmAccount(w.tx, "hash_ok", { name: "Second", passwordHash: "hash(second)" }, NOW),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "invalid" }]);
    expect(w.user.name).toBe("First"); // the loser never overwrote the account
  });

  it("does not overwrite an account that was confirmed in the meantime (another link)", async () => {
    const w = world({});
    w.user.emailVerifiedAt = new Date(NOW.getTime() - 1000); // confirmed after this token was read...
    const realFind = w.tx.findToken;
    w.tx.findToken = async (h: string) => {
      const t = await realFind(h);
      return t && { ...t, user: { ...t.user, emailVerifiedAt: null } }; // ...but it looked unconfirmed then
    };
    expect(await confirmAccount(w.tx, "hash_ok", account, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(w.user.name).toBe("");
    expect(w.sessions.size).toBe(2);
  });

  it("locks the account before using up the link (same order as deleting an account: no deadlock)", async () => {
    const w = world({});
    await confirmAccount(w.tx, "hash_ok", account, NOW);
    expect(w.calls).toEqual(["lockUser", "consumeToken"]);
  });

  it("stops without writing anything if the account was deleted meanwhile (e.g. replaced by 'Add manager')", async () => {
    const w = world({ userDeleted: true });
    expect(await confirmAccount(w.tx, "hash_ok", account, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(w.calls).toEqual(["lockUser"]);
    expect(w.tokens.has("hash_ok")).toBe(true);
    expect(w.user.passwordHash).toBeNull();
  });

  it("rejects an expired link without changing the account, and removes the link", async () => {
    const w = world({ tokenExpiresAt: new Date(NOW.getTime() - 1) });
    expect(await confirmAccount(w.tx, "hash_ok", account, NOW)).toEqual({ ok: false, reason: "expired" });
    expect(w.user.passwordHash).toBeNull();
    expect(w.sessions.size).toBe(2);
    expect(w.tokens.has("hash_ok")).toBe(false);
  });

  it("rejects unknown links, and links for staff or already-confirmed accounts, changing nothing", async () => {
    for (const w of [world({}), world({ user: { role: "SUPER_ADMIN" } }), world({ user: { emailVerifiedAt: NOW, passwordHash: "existing" } })]) {
      const token = w.user.role === "DONOR" && !w.user.emailVerifiedAt ? "hash_unknown" : "hash_ok";
      expect(await confirmAccount(w.tx, token, account, NOW)).toEqual({ ok: false, reason: "invalid" });
      expect(w.user.name).toBe("");
      expect(w.sessions.size).toBe(2);
    }
  });
});

describe("cleaning up unconfirmed signups", () => {
  it("only removes unconfirmed, password-less donor signups older than the link lifetime with no working link", () => {
    expect(STALE_SIGNUP_HOURS).toBe(24);
    expect(staleSignupWhere(NOW)).toEqual({
      role: "DONOR",
      emailVerifiedAt: null,
      passwordHash: null,
      createdAt: { lt: new Date("2026-11-13T10:00:00Z") },
      verificationTokens: { none: { expiresAt: { gt: NOW } } },
    });
  });

  it("lets 'Add manager' replace only an unconfirmed, password-less donor signup", () => {
    expect(replaceableSignupWhere("m@example.test")).toEqual({
      email: "m@example.test",
      role: "DONOR",
      emailVerifiedAt: null,
      passwordHash: null,
    });
  });
});
