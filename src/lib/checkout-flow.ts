/**
 * Decides what happens when a donor presses "Confirm and pay": reuse their payment page,
 * create one, or tell them why not. Stripe and the database are injected so every branch
 * can be unit tested (see checkout-flow.test.ts); src/app/actions/donate.ts wires the real ones.
 *
 * Duplicate-payment rules:
 * 1. A donation keeps ONE Stripe Checkout Session. Resubmitting the same confirm screen (also after
 *    a decline, when Stripe lets the donor try another card) goes back to that same page.
 * 2. Per browser and campaign, only the NEWEST open payment page may stay payable. After opening its
 *    page, a request closes every older open page from this browser, including its own if a newer
 *    one exists. Two tabs submitting at the same moment: at least one of the two requests sees the
 *    other (each stores its session before looking), and the older page is always the one closed.
 *    "This browser" is a random cookie, so other people using the same email are never affected.
 */

/** status is Stripe's "open" | "complete" | "expired"; anything else is treated as not payable. */
export type SessionInfo = { id: string; status: string | null; url: string | null };

/** A donation of this browser to this campaign that may still have an open payment page. */
export type BrowserCheckout = { donationId: string; createdAt: Date; sessionId: string };

export type CheckoutDeps = {
  now(): Date;
  /** null when Stripe no longer knows the session (e.g. test data was deleted). */
  retrieveSession(sessionId: string): Promise<SessionInfo | null>;
  expireSession(sessionId: string): Promise<void>;
  /** Creates this donation's session (idempotent per confirm screen). */
  createSession(): Promise<SessionInfo>;
  saveSessionId(sessionId: string): Promise<void>;
  /** This browser's PENDING/FAILED donations to this campaign that have a session, recent enough to be open. */
  findBrowserCheckouts(): Promise<BrowserCheckout[]>;
  /**
   * After createSession throws: "retry" if pressing the button again can work (the request never
   * reached Stripe, or our own database failed), "restart" if this confirm screen can't be reused
   * (Stripe replays the same error for the same idempotency key for 24 hours).
   */
  classifyCreateError(e: unknown): "retry" | "restart";
  onError(e: unknown): void;
};

export type CheckoutDonation = { id: string; createdAt: Date; stripeCheckoutSessionId: string | null };

export type CheckoutOutcome =
  | { kind: "redirect"; url: string } // to Stripe
  | { kind: "paid"; sessionId: string } // this donation's page was already paid: show the success page
  | { kind: "closed" } // this donation's page has ended: review again (new confirm screen)
  | { kind: "superseded" } // a newer payment page was opened in another tab of this browser
  | { kind: "retry" } // temporary problem: same confirm screen, press the button again
  | { kind: "restart" }; // this confirm screen can't be reused: review again

/**
 * Stripe needs expires_at at least 30 minutes ahead, and we derive it from the donation's
 * createdAt (+60 min) so retries send identical parameters. Past this age, start a new attempt.
 */
export const MAX_SESSION_CREATE_AGE_MS = 25 * 60 * 1000;

export async function openCheckout(deps: CheckoutDeps, donation: CheckoutDonation): Promise<CheckoutOutcome> {
  let own: SessionInfo | null;
  try {
    if (donation.stripeCheckoutSessionId) {
      own = await deps.retrieveSession(donation.stripeCheckoutSessionId);
      if (!own || own.status === "expired") return { kind: "closed" };
      if (own.status === "complete") return { kind: "paid", sessionId: own.id };
    } else {
      if (deps.now().getTime() - donation.createdAt.getTime() > MAX_SESSION_CREATE_AGE_MS) return { kind: "restart" };
      try {
        own = await deps.createSession();
      } catch (e) {
        deps.onError(e);
        return { kind: deps.classifyCreateError(e) };
      }
      // If this fails, pressing the button again recreates the SAME session (same idempotency key).
      await deps.saveSessionId(own.id);
    }
    if (own.status !== "open" || !own.url) return { kind: "closed" };

    const superseded = await closeOlderCheckouts(deps, {
      donationId: donation.id,
      createdAt: donation.createdAt,
      sessionId: own.id,
    });
    return superseded ? { kind: "superseded" } : { kind: "redirect", url: own.url };
  } catch (e) {
    // Retrieve/expire/database problems. If closing an older page failed we must not send the donor
    // to pay (both pages could be paid); the retry runs the cleanup again.
    deps.onError(e);
    return { kind: "retry" };
  }
}

/**
 * Expires every OPEN page of this browser+campaign except the newest open one. Returns true if
 * `own` is not that newest page. Pages that are no longer open (expired, paid, unknown to Stripe)
 * can't be paid and don't compete: a stale FAILED/PENDING row whose webhook hasn't arrived must
 * never make a working page close itself.
 */
async function closeOlderCheckouts(deps: CheckoutDeps, own: BrowserCheckout): Promise<boolean> {
  const others = (await deps.findBrowserCheckouts()).filter((c) => c.donationId !== own.donationId);

  const open: BrowserCheckout[] = [own]; // the caller only gets here when its own page is open
  for (const c of others) {
    const session = await deps.retrieveSession(c.sessionId);
    if (session?.status === "open") open.push(c);
  }

  const newest = open.reduce((a, b) => (isNewer(b, a) ? b : a));
  for (const c of open) {
    if (c.donationId !== newest.donationId) await closePage(deps, c.sessionId);
  }
  return newest.donationId !== own.donationId;
}

/**
 * Expire a page. Another request may close (or the donor may pay) it between our check and this
 * call, which makes Stripe reject the expire; that's fine as long as it is no longer open.
 */
async function closePage(deps: CheckoutDeps, sessionId: string): Promise<void> {
  try {
    await deps.expireSession(sessionId);
  } catch (e) {
    const now = await deps.retrieveSession(sessionId);
    if (now?.status === "open") throw e;
  }
}

/** Later createdAt wins; equal times are broken by id with a plain (locale-independent) comparison. */
function isNewer(a: BrowserCheckout, b: BrowserCheckout): boolean {
  const dt = a.createdAt.getTime() - b.createdAt.getTime();
  return dt !== 0 ? dt > 0 : a.donationId > b.donationId;
}

/** Sessions expire 60 minutes after the donation is created; look a little further back. */
export const OPEN_CHECKOUT_WINDOW_MS = 70 * 60 * 1000;

/**
 * The database filter for "this browser's donations to this campaign that may still have an open
 * payment page". Kept here (plain data, no Prisma import) so it is unit tested with the rules above.
 */
export function browserCheckoutsWhere(browserKeyHashes: string[], campaignId: string, now: Date) {
  return {
    browserKeyHash: { in: [...new Set(browserKeyHashes)] },
    campaignId,
    status: { in: ["PENDING" as const, "FAILED" as const] },
    stripeCheckoutSessionId: { not: null },
    createdAt: { gte: new Date(now.getTime() - OPEN_CHECKOUT_WINDOW_MS) },
  };
}
