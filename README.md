# Donation Manager

Donation management for a small charity: public campaign pages, once-off card donations through
Stripe (test mode), donor accounts with receipts, and staff dashboards with funder reporting.
Currency is ZAR only. Built for the "Payments and people" brief; the brief's **funder** is a donor
here. The full plan is in [docs/PLAN.md](docs/PLAN.md) and progress in [docs/PROGRESS.md](docs/PROGRESS.md).

## Who uses it

| Role | Can |
| --- | --- |
| Visitor / guest donor | Browse campaigns, donate without an account, get a receipt link by email |
| Donor (account) | See their own donations, impact and campaign progress, reveal their name on an anonymous gift, download their donations |
| Campaign manager | See dashboards for **their own** campaigns only: progress, donors (anonymous ones masked), failed attempts, charts, CSV export |
| Super admin | Everything a manager sees for **all** campaigns, plus create/edit campaigns and manager accounts |

## Running locally

```bash
cp .env.example .env            # then fill in the Stripe test keys
docker compose up -d            # Postgres + Mailpit (inbox at http://localhost:8025)
npm install
npx prisma migrate dev          # creates the tables
npx prisma db seed              # demo users, campaigns and six weeks of donations (wipes the DB!)
npm run dev                     # http://localhost:3000
```

In a second terminal, forward Stripe webhooks to the app (needs the [Stripe CLI](https://docs.stripe.com/stripe-cli)):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET in .env and restart `npm run dev`
```

Demo logins (from the seed): `admin@charity.local` / `ChangeMe123!`,
`thandi@charity.local` / `Manager123!`, `donor@example.com` / `Donor123!`.

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## How a donation is paid

1. **Details** (`/donate/[slug]`): amount, name, email, "give anonymously". Validated on the server; the
   campaign must be `ACTIVE` and today within its dates.
2. **Please confirm**: a summary with a warning that accidental donations cannot be refunded. Nothing
   is stored before this step.
3. **Confirm and pay**: creates a `PENDING` donation and a hosted Stripe Checkout Session, then
   redirects to Stripe. We never see card details. If Stripe can't be reached, the donation stays
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

## Key decisions

- **The webhook is the only source of "paid".** Pages never mark a donation paid; every status change
  is conditional and replayed events are ignored, so totals can't double-count.
- **Money is integer cents** everywhere; input accepts the South African decimal comma.
- **Duplicate payments** are stopped at four levels: the confirm step, one payment page per confirm
  screen (Stripe idempotency key), newest-page-wins per browser, and idempotent webhooks.
- **Anonymity is per gift and enforced on the server.** Staff pages and CSVs only ever receive
  masked rows, and staff donor counts treat each anonymous gift as its own donor, so the numbers
  can't reveal who gave it. Revealing a name is one-way.
- **Accounts can't be pre-hijacked**: no password until the inbox owner confirms; confirming ends
  other sessions; signup and login take the same time whether or not an account exists.
- **Pure, tested core logic** (metrics, checkout decisions, webhook processing, verification, exports)
  with the database and Stripe injected; the pages and routes are thin wrappers.

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

Test cards: `4242 4242 4242 4242` (succeeds), `4000 0000 0000 0002` (declined),
`4000 0000 0000 9995` (insufficient funds). Any future expiry date and any CVC.

## Limitations

- The payment flow was tested end to end with real Stripe test-mode webhooks (see docs/PROGRESS.md),
  but the dashboards and charts have not yet been checked visually in a browser.
- No rate limiting (signup emails, login attempts).
- Anyone with database access can read donor details; there is no column encryption.
- Tokens in URLs (`/verify-email?token=…`, `/receipt/<token>`) can appear in hosting access logs.
- Receipt emails are best effort: a failed email is not retried, and its link is lost.
- Blocked staff pages return HTTP 200 (showing "not found" or redirecting in the browser) because
  the page starts streaming before the access check; no data is shown.
- Dashboard numbers are computed in memory from paid donations: fine for a small charity, but would
  move to SQL aggregation at large volumes.
- "Newest payment page wins" works per browser; two different browsers can each have an open page.

## Future work

Recurring donations, campaign image upload, a retry queue for emails, rate limiting, column
encryption for donor details, 404/redirect status codes for blocked pages, deleting expired
sessions, and database-level integration tests for the query filters.
