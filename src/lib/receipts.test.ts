import { describe, expect, it } from "vitest";
import { sendReceiptOnce, type ReceiptData, type ReceiptDeps } from "./receipts";
import type { EmailContent } from "./email-templates";

const paid: ReceiptData = {
  email: "donor@example.test",
  name: "Test Donor",
  amountCents: 50_000,
  campaignName: "Winter Food Parcels",
  paidAt: new Date("2026-11-12T08:00:00Z"),
  isAnonymous: false,
};

/** In-memory donation store: one receipt hash per donation, claimed only once. */
function setup(opts: { data?: ReceiptData | null; sendOk?: boolean } = {}) {
  const hashes = new Map<string, string>();
  const sent: { to: string; content: EmailContent }[] = [];
  let n = 0;
  const deps: ReceiptDeps = {
    newToken: () => `token${++n}`,
    hash: (t) => `hash(${t})`,
    load: async () => (opts.data === undefined ? paid : opts.data),
    claim: async (id, h) => {
      if (hashes.has(id)) return false;
      hashes.set(id, h);
      return true;
    },
    send: async (to, content) => {
      sent.push({ to, content });
      return opts.sendOk ?? true;
    },
    appUrl: "http://localhost:3000",
  };
  return { deps, hashes, sent };
}

describe("sendReceiptOnce", () => {
  it("emails the donor a private link and stores only the token's hash", async () => {
    const t = setup();
    expect(await sendReceiptOnce(t.deps, "don_1")).toBe("sent");
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].to).toBe("donor@example.test");
    expect(t.sent[0].content.text).toContain("http://localhost:3000/receipt/token1");
    expect(t.hashes.get("don_1")).toBe("hash(token1)");
  });

  it("never sends a second receipt for the same donation (e.g. a second webhook delivery)", async () => {
    const t = setup();
    await sendReceiptOnce(t.deps, "don_1");
    expect(await sendReceiptOnce(t.deps, "don_1")).toBe("already-sent");
    expect(t.sent).toHaveLength(1);
    expect(t.hashes.get("don_1")).toBe("hash(token1)"); // the first link keeps working
  });

  it("sends at most one receipt when two attempts run at the same time", async () => {
    const t = setup();
    const results = await Promise.all([sendReceiptOnce(t.deps, "don_1"), sendReceiptOnce(t.deps, "don_1")]);
    expect(results.sort()).toEqual(["already-sent", "sent"]);
    expect(t.sent).toHaveLength(1);
  });

  it("sends nothing for a donation that isn't paid", async () => {
    const t = setup({ data: null });
    expect(await sendReceiptOnce(t.deps, "don_1")).toBe("not-paid");
    expect(t.sent).toHaveLength(0);
    expect(t.hashes.size).toBe(0);
  });

  it("reports a failed email without throwing (best effort; the payment is unaffected)", async () => {
    const t = setup({ sendOk: false });
    expect(await sendReceiptOnce(t.deps, "don_1")).toBe("email-failed");
  });
});
