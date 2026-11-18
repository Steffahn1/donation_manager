# Architecture and behaviour

The detailed "how it works" behind the [README](../README.md): the payment flow, duplicate and failed
payments, donor accounts, reporting and privacy. Rules the code must never break are in
[CLAUDE.md](../CLAUDE.md); the original requirements and design are in [PLAN.md](PLAN.md).

## Code map

| Area | Where |
| --- | --- |
| Pages, Server Actions, Route Handlers | `src/app/` (`actions/`, `api/export/`, `api/webhooks/stripe/`) |
| Payment decisions (duplicates, newest page wins) | `src/lib/checkout-flow.ts` |
| Webhook processing (the only place a donation becomes paid) | `src/lib/stripe-webhook.ts` (+ `stripe-webhook-db.ts`) |
| Anonymous masking for staff | `src/lib/privacy.ts` |
| Role checks and campaign scoping | `src/lib/auth.ts`, `src/lib/access.ts`, `campaignScopeFor` in `src/lib/campaigns.ts` |
| Dashboard numbers and charts | `src/lib/metrics.ts` |
| Signup, email confirmation, login | `src/lib/verification*.ts`, `src/lib/login.ts` |
| Receipts and CSV exports | `src/lib/receipts.ts`, `src/lib/exports.ts`, `src/lib/csv.ts` |
| Database queries (server only) | `src/lib/queries/` |
| Schema, migrations, demo data | `prisma/` |

The logic in `src/lib/` is pure and unit-tested (`*.test.ts` next to each file), with the database and
Stripe passed in; pages and routes are thin wrappers around it.

## How a donation is paid

1. **Details** (`/donate/[slug]`): amount, name, email, "give anonymously". Validated on the server; the
   campaign must be `ACTIVE` and today within its dates.
2. **Please confirm**: a summary with a warning that accidental donations cannot be refunded. Nothing
   is stored before this step.
3. **Confirm and pay**: creates a `PENDING` donation and a hosted Stripe Checkout Session, then
   redirects to Stripe. The app never sees card details. If Stripe can't be reached, the donation stays
   `PENDING` (it is not a declined payment). If the request never reached Stripe the donor can press
   the button again; otherwise they review the donation again.
4. **Webhook** (`/api/webhooks/stripe`): the only place a donation becomes `SUCCEEDED`. The success
   page just reads the status and refreshes until the webhook has arrived.

| Event | Effect |
| --- | --- |
| `checkout.session.completed` (paid, amount matches) | `PENDING`/`FAILED` → `SUCCEEDED` |
| `payment_intent.payment_failed` | `PENDING` → `FAILED`, with the decline reason |
| `checkout.session.expired` | `PENDING` → `EXPIRED` |

Only `SUCCEEDED` donations count towards any total. `FAILED` attempts are kept so staff can see them.

### Failed payments

Stripe Checkout shows a declined card on its own page and lets the donor try another card; the
donation is marked `FAILED` meanwhile and becomes `SUCCEEDED` if a retry works. If the donor leaves
instead, `/donate/cancelled` explains they weren't charged and offers **Try again**. That closes the
old Checkout Session at Stripe (so it can't also be paid in another tab) and refills the form from
this browser tab's `sessionStorage`.

### Duplicate payments

- The confirm step, plus the button disabled while submitting and while the browser leaves for Stripe.
- Each confirm screen gets a random attempt id. It is unique on the donation row and is the Stripe
  idempotency key, so a resubmitted confirm form returns the same Checkout Session, not a second one.
  That includes after a decline: the donor goes back to the still-open payment page.
- Per browser and campaign, only the newest open payment page stays payable: after opening its page,
  a request closes older open pages from the same browser (a random cookie, never matched by email,
  so other people giving with the same email are unaffected). Two tabs submitting at once can't both
  stay payable. The rules and their tests are in `src/lib/checkout-flow.ts`.
- Checkout Sessions expire an hour after they are created, so an old payment tab can't be paid much later.
- Every processed webhook event id is stored in `StripeEvent` in the same transaction as the donation
  update. A redelivered or replayed event is ignored.
- Status updates are conditional (`WHERE status IN (...)`), so a late or out-of-order event never
  downgrades a `SUCCEEDED` donation.

## Donor accounts and receipts

- **Sign up** at `/signup` with just an email address. Every signup shows the same "check your email"
  page, immediately, whether or not the address already has an account. The email (open it in Mailpit
  at http://localhost:8025) links to a page where you **choose your name and password and confirm**;
  only submitting that form verifies the address (email scanners open links automatically). Links last
  24 hours and work once. An account has no password until it is confirmed, so nobody can sign up
  with someone else's email and keep access; confirming also ends any other sessions.
- Donations made with that email are linked to the account **only after it is confirmed**, so nobody
  can see someone else's gifts by signing up with their address.
- The donor dashboard shows history, total given, impact and campaign progress. On an anonymous gift
  the donor can choose **Show my name**; that is permanent, and a named gift can't be made anonymous.
- Unconfirmed signups are removed after their link expires (24 hours). If someone started a signup
  with an email the admin later uses for a campaign manager, "Add manager" replaces that unconfirmed
  signup.
- When the webhook marks a donation paid, the donor gets **one receipt email** with a private link
  (`/receipt/[token]`; only a hash of the token is stored). Sending is best effort and never affects
  the payment.

Signup and receipt emails are sent after the response (Next.js `after()`). When self-hosting, stop the
server gracefully (SIGTERM) so pending emails still go out.

## Dashboards and reporting

- **Numbers** (`src/lib/metrics.ts`): gross raised (before payment-provider fees), donations, unique
  and repeat donors, this week vs last week, and new vs returning donors ("returning" = gave to the
  same campaign before this week). Only paid donations count. Days and weeks are Johannesburg time.
- **Charts**: a long-term chart (money per day and the running total since the start) and a
  week-by-week comparison (last 8 Monday–Sunday weeks, this week marked). On the overview and on
  each campaign page. Closed campaigns' charts end on their last day (a payment completed
  after midnight counts on that day, so the running total always matches "Raised"). The
  browser only receives dates, amounts and donation counts (no donor details).
- **CSV exports** with a date range (Johannesburg days, both included; default the last 12 months),
  **paid donations only**:
  - staff: `/api/export/donations.csv?from=…&to=…[&campaign=…]`, scoped like the dashboards; a
    manager asking for another manager's campaign gets an empty file
  - donors: `/api/export/my-donations.csv?from=…&to=…`, their own donations only
  - anonymous donors appear as "Anonymous" with no email; cells that could run as spreadsheet
    formulas are neutralised; 401 when logged out, 403 for the wrong role

## Privacy

- Minimal data: name, email, amount, and the per-gift anonymity choice. Card details never touch
  the app (Stripe Checkout).
- Staff never see an anonymous donor's identity, in pages or exports. Public pages show no donor
  details at all.
- Tokens (sessions, verification links, receipt links) are stored only as SHA-256 hashes; pages with
  tokens in the URL are `noindex` and `no-referrer`.
- Logs contain ids and error codes only, never names, emails or error messages from Stripe.

### Privacy note: the browser cookie

To close a donor's own older payment pages, the app sets a random, httpOnly cookie (`dm_browser`)
when the donor reaches the confirm step. Each new donation stores only a SHA-256 hash of it. The hash
links donations made from the same browser, so it is kept only while a payment page can still be
open: the webhook clears it when a payment completes or a page expires, and anything older than
70 minutes is cleared on the next checkout. Staff screens never show it.
