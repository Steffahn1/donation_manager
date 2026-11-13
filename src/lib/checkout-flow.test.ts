import { describe, expect, it } from "vitest";
import {
  MAX_SESSION_CREATE_AGE_MS,
  OPEN_CHECKOUT_WINDOW_MS,
  browserCheckoutsWhere,
  openCheckout,
  type CheckoutDeps,
  type CheckoutDonation,
  type SessionInfo,
} from "./checkout-flow";

const NOW = new Date("2026-11-13T10:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

type Row = {
  id: string;
  createdAt: Date;
  status: "PENDING" | "FAILED" | "SUCCEEDED" | "EXPIRED";
  sessionId: string | null;
  browserKey: string;
  campaignId: string;
};

/**
 * A shared fake "world": Stripe's sessions plus our donation rows. Each request gets its own deps
 * over that world, so the database query sees exactly what has been stored so far, including the
 * request's OWN row once its session id is saved (like the real query).
 */
function world(opts: { sessions?: Record<string, string>; rows?: Row[] } = {}) {
  const sessions = new Map(Object.entries(opts.sessions ?? {}));
  const rows = new Map((opts.rows ?? []).map((r) => [r.id, { ...r }]));
  const expired: string[] = [];
  let created = 0;

  const info = (id: string): SessionInfo => {
    const status = sessions.get(id) ?? null;
    return { id, status, url: status === "open" ? `https://checkout.stripe.test/${id}` : null };
  };

  function request(
    donationId: string,
    o: {
      browserKey?: string;
      createError?: unknown;
      classify?: "retry" | "restart";
      failRetrieveFor?: string;
      failSave?: boolean;
      beforeFind?: () => Promise<void>;
    } = {},
  ) {
    const errors: unknown[] = [];
    const browserKey = o.browserKey ?? "browser_1";
    const deps: CheckoutDeps = {
      now: () => NOW,
      async retrieveSession(id) {
        if (id === o.failRetrieveFor) throw new Error("network down");
        return sessions.has(id) ? info(id) : null;
      },
      async expireSession(id) {
        // Real Stripe rejects expiring a session that isn't open.
        if (sessions.get(id) !== "open") throw new Error(`cannot expire ${id}: ${sessions.get(id)}`);
        sessions.set(id, "expired");
        expired.push(id);
      },
      async createSession() {
        if (o.createError) throw o.createError;
        created++;
        const id = `cs_${donationId}`;
        sessions.set(id, "open");
        return info(id);
      },
      async saveSessionId(id) {
        if (o.failSave) throw new Error("db down");
        rows.get(donationId)!.sessionId = id;
      },
      async findBrowserCheckouts() {
        await o.beforeFind?.();
        const cutoff = NOW.getTime() - OPEN_CHECKOUT_WINDOW_MS;
        return [...rows.values()]
          .filter(
            (r) =>
              r.browserKey === browserKey &&
              r.campaignId === "camp_1" &&
              (r.status === "PENDING" || r.status === "FAILED") &&
              r.sessionId !== null &&
              r.createdAt.getTime() >= cutoff,
          )
          .map((r) => ({ donationId: r.id, createdAt: r.createdAt, sessionId: r.sessionId! }));
      },
      classifyCreateError: () => o.classify ?? "restart",
      onError: (e) => errors.push(e),
    };
    const row = rows.get(donationId);
    if (!row) throw new Error(`test setup: no row ${donationId}`);
    const donation: CheckoutDonation = { id: row.id, createdAt: row.createdAt, stripeCheckoutSessionId: row.sessionId };
    return { run: () => openCheckout(deps, donation), errors };
  }

  return { sessions, rows, expired, request, created: () => created };
}

const row = (id: string, minutes: number, extra: Partial<Row> = {}): Row => ({
  id,
  createdAt: minutesAgo(minutes),
  status: "PENDING",
  sessionId: null,
  browserKey: "browser_1",
  campaignId: "camp_1",
  ...extra,
});

describe("openCheckout: one donation keeps one payment page", () => {
  it("creates a session for a new donation, stores it and redirects to it", async () => {
    const w = world({ rows: [row("new", 1)] });
    const r = w.request("new");
    expect(await r.run()).toEqual({ kind: "redirect", url: "https://checkout.stripe.test/cs_new" });
    expect(w.rows.get("new")!.sessionId).toBe("cs_new");
    expect(r.errors).toEqual([]);
  });

  it("sends a resubmitted confirm screen to the SAME open page (also after a decline), never a new one", async () => {
    const w = world({ sessions: { cs_d1: "open" }, rows: [row("d1", 5, { status: "FAILED", sessionId: "cs_d1" })] });
    const r = w.request("d1");
    expect(await r.run()).toEqual({ kind: "redirect", url: "https://checkout.stripe.test/cs_d1" });
    expect(w.created()).toBe(0);
    expect(r.errors).toEqual([]);
  });

  it("shows the success page when the page was already paid", async () => {
    const w = world({ sessions: { cs_d1: "complete" }, rows: [row("d1", 5, { sessionId: "cs_d1" })] });
    expect(await w.request("d1").run()).toEqual({ kind: "paid", sessionId: "cs_d1" });
  });

  it("says the page has closed when it expired or Stripe no longer knows it", async () => {
    const expiredPage = world({ sessions: { cs_d1: "expired" }, rows: [row("d1", 5, { sessionId: "cs_d1" })] });
    expect(await expiredPage.request("d1").run()).toEqual({ kind: "closed" });
    const missing = world({ rows: [row("d1", 5, { sessionId: "cs_d1" })] });
    expect(await missing.request("d1").run()).toEqual({ kind: "closed" });
    expect(missing.created()).toBe(0);
  });
});

describe("openCheckout: only the newest OPEN payment page of this browser stays payable", () => {
  it("closes this browser's older open page before sending the donor to pay (Back after a decline)", async () => {
    const w = world({
      sessions: { cs_old: "open" },
      rows: [row("old", 10, { status: "FAILED", sessionId: "cs_old" }), row("new", 1)],
    });
    const r = w.request("new");
    expect(await r.run()).toMatchObject({ kind: "redirect" });
    expect(w.expired).toEqual(["cs_old"]);
    expect(r.errors).toEqual([]);
  });

  it("never touches another browser's page, even for the same campaign", async () => {
    const w = world({
      sessions: { cs_other: "open" },
      rows: [row("other", 10, { sessionId: "cs_other", browserKey: "browser_2" }), row("new", 1)],
    });
    expect(await w.request("new").run()).toMatchObject({ kind: "redirect" });
    expect(w.expired).toEqual([]);
  });

  it("never expires a page that was already paid (a deliberate earlier gift)", async () => {
    const w = world({ sessions: { cs_paid: "complete" }, rows: [row("paid", 10, { sessionId: "cs_paid" }), row("new", 1)] });
    const r = w.request("new");
    expect(await r.run()).toMatchObject({ kind: "redirect" });
    expect(w.expired).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("is not superseded by a NEWER row whose page is closed (declined, then 'Try again'; webhook not in yet)", async () => {
    const w = world({
      sessions: { cs_a: "open", cs_b: "expired" },
      rows: [row("a", 10, { sessionId: "cs_a" }), row("b", 5, { status: "FAILED", sessionId: "cs_b" })],
    });
    const r = w.request("a");
    expect(await r.run()).toEqual({ kind: "redirect", url: "https://checkout.stripe.test/cs_a" });
    expect(w.expired).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("is not superseded by a newer page that was just paid (webhook not in yet)", async () => {
    const w = world({
      sessions: { cs_a: "open", cs_b: "complete" },
      rows: [row("a", 10, { sessionId: "cs_a" }), row("b", 5, { sessionId: "cs_b" })],
    });
    expect(await w.request("a").run()).toMatchObject({ kind: "redirect" });
  });

  it("ignores pages Stripe no longer knows (e.g. deleted test data) instead of blocking the donor", async () => {
    const w = world({ rows: [row("gone", 10, { sessionId: "cs_gone" }), row("new", 1)] });
    const r = w.request("new");
    expect(await r.run()).toMatchObject({ kind: "redirect" });
    expect(r.errors).toEqual([]);
  });

  it("does NOT send the donor to pay if an older open page could not be checked (both could be paid)", async () => {
    const w = world({ sessions: { cs_old: "open" }, rows: [row("old", 10, { sessionId: "cs_old" }), row("new", 1)] });
    const r = w.request("new", { failRetrieveFor: "cs_old" });
    expect(await r.run()).toEqual({ kind: "retry" });
    expect(r.errors).toHaveLength(1);
  });

  it("breaks a tie on createdAt by id, the same way in every request", async () => {
    const w = world({ rows: [row("x", 2), row("y", 2)] });
    const [rx, ry] = [w.request("x"), w.request("y")];
    await rx.run();
    const second = await ry.run();
    // "y" > "x", so y is newest: x's page is closed and y may pay.
    expect(second).toMatchObject({ kind: "redirect" });
    expect(w.sessions.get("cs_x")).toBe("expired");
    expect(w.sessions.get("cs_y")).toBe("open");
  });
});

describe("openCheckout: two tabs of one browser pressing Confirm at the same moment", () => {
  it("both store first, then both look: the older page is closed, only the newer may be paid", async () => {
    const w = world({ rows: [row("a", 2), row("b", 1)] });
    // Hold both requests just before their lookup until both have stored their session.
    let release!: () => void;
    const bothSaved = new Promise<void>((r) => (release = r));
    let waiting = 0;
    const gate = async () => {
      if (++waiting === 2) release();
      await bothSaved;
    };
    const [ra, rb] = [w.request("a", { beforeFind: gate }), w.request("b", { beforeFind: gate })];
    const [outA, outB] = await Promise.all([ra.run(), rb.run()]);

    expect(outA).toEqual({ kind: "superseded" });
    expect(outB).toMatchObject({ kind: "redirect" });
    expect(w.sessions.get("cs_a")).toBe("expired");
    expect(w.sessions.get("cs_b")).toBe("open");
    // Both tried to close cs_a; the loser's rejected expire is not an error.
    expect(ra.errors).toEqual([]);
    expect(rb.errors).toEqual([]);
  });

  it("the older request finishes first and misses the newer one: the newer request closes the older page", async () => {
    const w = world({ rows: [row("a", 2), row("b", 1)] });
    expect(await w.request("a").run()).toMatchObject({ kind: "redirect" }); // sees nothing yet
    expect(await w.request("b").run()).toMatchObject({ kind: "redirect" }); // sees a, closes it
    expect(w.sessions.get("cs_a")).toBe("expired");
    expect(w.sessions.get("cs_b")).toBe("open");
  });
});

describe("openCheckout: errors", () => {
  it("asks for a new confirm screen when Stripe answered with an error (it replays it for the same key)", async () => {
    const w = world({ rows: [row("new", 1)] });
    expect(await w.request("new", { createError: new Error("stripe 500"), classify: "restart" }).run()).toEqual({
      kind: "restart",
    });
  });

  it("lets the donor press the same button again when the request never reached Stripe", async () => {
    const w = world({ rows: [row("new", 1)] });
    expect(await w.request("new", { createError: new Error("ECONNRESET"), classify: "retry" }).run()).toEqual({
      kind: "retry",
    });
  });

  it("lets the donor retry when storing the session id failed (same key returns the same session)", async () => {
    const w = world({ rows: [row("new", 1)] });
    expect(await w.request("new", { failSave: true }).run()).toEqual({ kind: "retry" });
  });

  it("starts a new attempt once the donation is too old for a valid Stripe expiry time", async () => {
    const old = new Date(NOW.getTime() - MAX_SESSION_CREATE_AGE_MS - 1);
    const w = world({ rows: [{ ...row("old", 0), createdAt: old }] });
    expect(await w.request("old").run()).toEqual({ kind: "restart" });
    expect(w.created()).toBe(0);
  });
});

describe("browserCheckoutsWhere", () => {
  it("finds this browser's possibly-open pages for the campaign within the window", () => {
    expect(browserCheckoutsWhere(["h1", "h2", "h1"], "camp_1", NOW)).toEqual({
      browserKeyHash: { in: ["h1", "h2"] },
      campaignId: "camp_1",
      status: { in: ["PENDING", "FAILED"] },
      stripeCheckoutSessionId: { not: null },
      createdAt: { gte: new Date(NOW.getTime() - OPEN_CHECKOUT_WINDOW_MS) },
    });
  });

  it("looks back at least as long as a page can stay open (expires 60 min after the donation is created)", () => {
    expect(OPEN_CHECKOUT_WINDOW_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });
});
