import { describe, expect, it } from "vitest";
import { revealOwnGift } from "./reveal";

type Gift = { id: string; ownerUserId: string | null; status: string; isAnonymous: boolean };

/**
 * In-memory donations with an update that applies the filter the way Postgres/Prisma does
 * (every condition must match, including the relation donor.userId), so these tests exercise
 * the real filter and data the action sends, not just constants.
 */
function store(gifts: Gift[]) {
  const rows = new Map(gifts.map((g) => [g.id, { ...g }]));
  const update = async (
    where: { id: string; status: string; isAnonymous: boolean; donor: { userId: string } },
    data: { isAnonymous: boolean },
  ) => {
    let n = 0;
    for (const r of rows.values()) {
      if (r.id === where.id && r.status === where.status && r.isAnonymous === where.isAnonymous && r.ownerUserId === where.donor.userId) {
        Object.assign(r, data);
        n++;
      }
    }
    return n;
  };
  return { rows, update };
}

const jane = { id: "user_jane", role: "DONOR", emailVerified: true };
const gifts: Gift[] = [
  { id: "a1", ownerUserId: "user_jane", status: "SUCCEEDED", isAnonymous: true },
  { id: "a2", ownerUserId: "user_jane", status: "SUCCEEDED", isAnonymous: false },
  { id: "a3", ownerUserId: "user_jane", status: "FAILED", isAnonymous: true },
  { id: "b1", ownerUserId: "user_bob", status: "SUCCEEDED", isAnonymous: true },
  { id: "g1", ownerUserId: null, status: "SUCCEEDED", isAnonymous: true }, // guest, unlinked
];

describe("revealOwnGift", () => {
  it("reveals the donor's own paid anonymous gift", async () => {
    const s = store(gifts);
    expect(await revealOwnGift(s.update, jane, "a1")).toEqual({ ok: true });
    expect(s.rows.get("a1")!.isAnonymous).toBe(false);
  });

  it("is one-way: revealing again changes nothing, and a named gift never becomes anonymous", async () => {
    const s = store(gifts);
    await revealOwnGift(s.update, jane, "a1");
    expect((await revealOwnGift(s.update, jane, "a1")).ok).toBe(false);
    expect((await revealOwnGift(s.update, jane, "a2")).ok).toBe(false);
    expect(s.rows.get("a1")!.isAnonymous).toBe(false);
    expect(s.rows.get("a2")!.isAnonymous).toBe(false);
  });

  it("never touches someone else's gift or an unlinked guest gift", async () => {
    const s = store(gifts);
    expect((await revealOwnGift(s.update, jane, "b1")).ok).toBe(false);
    expect((await revealOwnGift(s.update, jane, "g1")).ok).toBe(false);
    expect(s.rows.get("b1")!.isAnonymous).toBe(true);
    expect(s.rows.get("g1")!.isAnonymous).toBe(true);
  });

  it("only reveals paid gifts, like the dashboard button", async () => {
    const s = store(gifts);
    expect((await revealOwnGift(s.update, jane, "a3")).ok).toBe(false);
    expect(s.rows.get("a3")!.isAnonymous).toBe(true);
  });

  it("rejects unconfirmed accounts, non-donors and malformed ids without touching anything", async () => {
    const s = store(gifts);
    let calls = 0;
    const counting = async (...args: Parameters<typeof s.update>) => (calls++, s.update(...args));
    expect((await revealOwnGift(counting, { ...jane, emailVerified: false }, "a1")).ok).toBe(false);
    expect((await revealOwnGift(counting, { ...jane, role: "CAMPAIGN_MANAGER" }, "a1")).ok).toBe(false);
    expect((await revealOwnGift(counting, jane, "a1' OR 1=1")).ok).toBe(false);
    expect((await revealOwnGift(counting, jane, { id: "a1" })).ok).toBe(false);
    expect(calls).toBe(0);
    expect(s.rows.get("a1")!.isAnonymous).toBe(true);
  });
});
