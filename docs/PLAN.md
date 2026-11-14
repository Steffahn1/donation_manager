# Donation Manager — Plan

Living plan for the project. Status per day is tracked in [PROGRESS.md](PROGRESS.md); rules for working
on the code are in [CLAUDE.md](../CLAUDE.md). Last updated 2026-11-14 (after Day 3).

## Context
5-day assessment project ("Payments and people" brief): donation management for a small charity running
a few campaigns with once-off donations. The brief asks:
- what to store about donors, donations and campaigns
- how to handle failed and duplicate payments
- what staff dashboards and funder reporting look like
- how to treat donor details with care

It needs a database, a frontend and more than one kind of user.

**Stack:** TypeScript, Next.js 16 (App Router, `cacheComponents` on), React 19, Prisma 7 + Postgres,
Tailwind 4, zod, vitest. **Currency:** ZAR only. **Payments:** Stripe test mode only.

The full scope (about 6 days of work) was kept, built in strict priority order so an overrun only cuts
into polish (see Build order).

## Requirements

### Roles
- **Super admin:** one account, created by the seed script. Creates campaigns, creates campaign manager
  (CM) accounts (email + initial password) and assigns campaigns. Sees all campaigns and CMs.
- **Campaign manager (CM):** sees only the campaigns assigned to them. Each campaign has exactly one CM;
  a CM can have many campaigns.
- **Donor:** gives as a guest or with an account (email + password). The brief's "funder" means a donor
  (to be noted in the README).

### Campaigns
- Fields: name, description, target in ZAR, start/end date, status (draft/active/closed), image and
  impact unit (e.g. "R500 = 1 family fed").
- The image is a static file in `/public` (placeholder SVGs in `public/campaigns/`); upload is future work.
- Donations are accepted only when the campaign is `ACTIVE` and today (Johannesburg time) falls between
  the start and end dates.
- Admin form limits: amounts up to R10 000 000, real calendar dates only.

### Amounts
- Stored and calculated as integer cents, never floats.
- Donations: minimum R20, maximum R100 000.
- Typed amounts accept the South African format and others: `250,50`, `250.50`, `1 000,00`,
  `1,000.00`, `1.000,50`. Spaces only between groups of three digits. Anything ambiguous is rejected,
  never guessed (`parseRandToCents` in `src/lib/money.ts`).

### Donations & payments
- Once-off only (recurring is future work). Stripe **test mode**, hosted **Checkout**, cards only.
- Two steps on our side: **details**, then **"Please confirm your payment"** with a warning that
  accidental donations are non-refundable. Nothing is stored before the confirm step.
- **Declined card:** Stripe's page shows the decline and lets the donor try another card. Our donation
  is `FAILED` meanwhile and can still become `SUCCEEDED`. If the donor leaves, the cancelled page offers
  "Try again", which closes the old payment page first.
- Failed attempts are recorded (`FAILED`, with the decline reason), visible to staff, and excluded from
  all totals. Only `SUCCEEDED` counts anywhere.
- The **webhook is the only source of truth** for `SUCCEEDED`. The success page only reads the status
  and waits for the webhook; it never marks anything paid and never says "not charged" while waiting.
- Stripe outages are not declines: the donation stays `PENDING` and is never counted. The donor can
  press the button again only when that can work (the request never reached Stripe, a rate limit, or
  our own database failed); otherwise they review the donation again.

### Duplicate payments
- The confirm step, and the button disabled while submitting and while the browser leaves for Stripe.
- Each confirm screen gets a random **attempt id**, unique on the donation and used as the Stripe
  idempotency key: resubmitting the same screen reuses the same donation and payment page.
- **One payment page per donation:** a resubmit (also after a decline) goes back to the same open page.
- **Newest page wins, per browser:** after opening its page, a request closes this browser's older
  *open* pages for the same campaign, including its own if a newer one exists. Two tabs pressing
  "Confirm and pay" at the same moment can't both stay payable. "This browser" is a random cookie,
  never the email, so other people giving with the same email are never affected. Already-paid pages
  are never closed, so a deliberate second gift still works.
- Payment pages expire 60 minutes after the donation is created.
- **Webhook:** every event id is recorded in `StripeEvent` in the same transaction as the donation
  update (`INSERT ... ON CONFLICT DO NOTHING`), so replays are ignored. Updates are conditional, so status
  only moves forward and a late event never downgrades `SUCCEEDED`. The amount and currency Stripe
  charged must match the donation.

### Donor identity & privacy
- A `Donor` record is keyed by email and kept separate from the optional `User` login. Every donation is
  stored whether or not the donor has an account. A public form never renames an existing donor.
- Each donation stores the **name typed for that gift** (`donorName`). Staff see that name, not the
  shared `Donor.name` (one email can be shared, e.g. by a household). The confirm screen shows exactly
  what staff will see.
- Guests get a receipt email with a private status link (random token). Only a **hash** of the token is
  stored (`receiptTokenHash`); the raw token exists only in the email.
- Donor signup requires **email verification** before guest donations with that email are linked to the
  account.
- Minimal data: name, email and amount. No card data is ever stored (Stripe holds it).
- **Anonymous flag per donation:**
  - Full details are always stored.
  - **No staff role (CM or super admin) ever sees the identity.** It is masked server-side to
    "Anonymous" in pages *and* CSVs (`toStaffDonation` in `src/lib/privacy.ts`). Only the donor sees it.
  - A logged-in donor can un-anonymise a donation.
  - Staff donor stats never link gifts: each anonymous gift counts as its own one-off donor in unique,
    repeat and new vs returning counts (on dashboards and in CSVs). Counting them under the real donor
    would let staff work out who gave anonymously (e.g. "1 unique donor" next to "Jane R100" and
    "Anonymous R500"). Trade-off: unique donors can be slightly high, repeat/returning slightly low.
    Money totals are unaffected, and the donor's own dashboard still uses their real identity.
- Public pages never show donor details.
- No donor names or emails in logs, error messages or URLs. Errors are logged via `errorSummary`, which
  never includes the error message (Stripe echoes rejected values such as emails).
- **Browser cookie (`dm_browser`):** random, httpOnly, set at the review step. Each donation stores only
  its hash, and only while a payment page can still be open; the webhook clears it when a payment
  completes or a page expires, and anything older than 70 minutes is cleared on the next checkout.
- README limitation: anyone with database access can still read PII. Column encryption is future work.

### Dashboards & reporting
- **CM (per campaign):**
  - progress bar of gross raised vs target, labelled "gross, before fees"
  - daily and cumulative pacing, comparing this week with previous weeks (Recharts)
  - number of donations and number of unique donors
  - new vs returning donors ("returning" means they gave to *this* campaign before; anonymous gifts
    always count as new)
  - donor list (anonymity masked) and failed attempts list
- **Super admin:** the same metrics across all campaigns, plus a per-campaign summary table and the CM list.
- **Donor:**
  - donation history with status
  - progress of each campaign they gave to
  - total given and impact ("you fed 3 families")
  - anonymity toggle
- **CSV export with a date range** for all three roles, limited to what each role can see.
- Staff and donor views must leave out `PENDING` donations that never got a payment page (no session id):
  they are not real payments.

### Email
Dev only: Mailpit (in Docker) via nodemailer, for receipts and verification links.

## Technical approach
- **Infra:** `docker-compose.yml` with Postgres and Mailpit. `.env` (not committed) holds `DATABASE_URL`,
  `STRIPE_SECRET_KEY` (must be `sk_test_`), `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  `SMTP_*`, `EMAIL_FROM`, `APP_URL`; `.env.example` lists them without real values.
- **ORM:** Prisma 7 with the pg adapter; generated client in `src/generated/prisma` (never edited).
- **Auth:** custom database-backed sessions (httpOnly cookie, only the token hash stored), bcrypt
  passwords. `requireRole` guards every protected page and Server Action (`getUserWithRole` in Route
  Handlers); `campaignScopeFor(user)` limits CM queries to their campaigns. `proxy.ts` is only an
  optimistic redirect.
- **Schema** (`prisma/schema.prisma`):
  - `User`: email (unique), passwordHash, role (SUPER_ADMIN, CAMPAIGN_MANAGER or DONOR), name, emailVerifiedAt
  - `Session` and `EmailVerificationToken` (hashed token, expiry)
  - `Donor`: email (unique), name, userId (optional, unique)
  - `Campaign`: slug, name, description, targetCents, startDate, endDate, status, imagePath,
    impactAmountCents, impactLabel, managerId → User
  - `Donation`:
    - donorId, donorName, campaignId, amountCents, currency (ZAR)
    - status (PENDING, SUCCEEDED, FAILED or EXPIRED), isAnonymous, failureReason, createdAt, paidAt
    - checkoutAttemptId (unique), stripeCheckoutSessionId (unique), stripePaymentIntentId (unique)
    - browserKeyHash (temporary), receiptTokenHash (unique, set when the receipt is emailed)
  - `StripeEvent`: id (the Stripe event id, primary key), type, processedAt
- **Key modules** (`src/lib/`):
  - `auth.ts`: sessions, `requireRole`, `getUserWithRole`
  - `privacy.ts`: `toStaffDonation`, the single masking function for all staff queries and CSVs
  - `money.ts`: `parseRandToCents`, `formatZar`, limits, impact units
  - `campaigns.ts`: accepting-donations rules (Johannesburg time), `campaignScopeFor`, `slugify`
  - `donations.ts`: donate-form validation (zod)
  - `checkout-flow.ts`: the duplicate-payment decision logic (`openCheckout`), Stripe and DB injected
  - `stripe.ts`: Stripe client, `createCheckoutSession`, error helpers (`errorSummary`, `classifyCreateError`)
  - `stripe-webhook.ts` + `stripe-webhook-db.ts`: webhook processing and its typed DB adapter
  - `browser-key.ts`: the `dm_browser` cookie
  - `queries/`: server-only database queries
  - `metrics.ts`: shared totals, counts, new vs returning, daily series (pure, unit tested), reused by
    dashboards, the Day 5 CSVs and pacing chart
  - `queries/staff.ts`: staff dashboard queries, all scoped with `campaignScopeFor`
  - `email.ts` (Day 4): nodemailer to Mailpit
- **Webhook** (`src/app/api/webhooks/stripe/route.ts`): verifies the signature on the raw body, then
  handles `checkout.session.completed`, `checkout.session.expired` and `payment_intent.payment_failed`.
- **Routes:**
  - public: `/campaigns`, `/campaigns/[slug]`
  - donating: `/donate/[slug]` (details → confirm → Stripe), `/donate/success`, `/donate/cancelled`
    (try again), `/receipt/[token]` (Day 4)
  - accounts: `/login`, `/signup` and `/verify-email` (Day 4)
  - dashboards and admin: `/dashboard` (routed by role), `/dashboard/campaigns/[id]` (staff),
    `/admin/campaigns`, `/admin/managers`
  - exports: `/api/export/*.csv` (Day 5)

## Build order (the stop line comes after step 4)
1. **Day 1 (done):** scaffold, Docker, Prisma schema and seed (super admin, CMs, campaigns, six weeks of
   demo donations), auth and roles, campaign create/edit and assignment, public pages.
2. **Day 2 (done, plus three review rounds):** Stripe Checkout, confirm step, webhooks, failed and
   duplicate handling, cancel/try-again, amount parsing, unit tests.
3. **Day 3 (done):** CM dashboard (metrics, masking, donor list, failed attempts) and super admin
   dashboard at `/dashboard` and `/dashboard/campaigns/[id]`.
4. **Day 4:** donor dashboard with impact and anonymity toggle; signup verification and guest linking;
   receipt email and private link (hashed token).
5. **Day 5:** CSV exports, pacing chart, more tests (metrics, role guards), README (decisions, privacy,
   limitations, future work) and polish. Also: make `getUserWithRole()` with no roles behave like
   `requireRole()`.

## Verification
- **Setup:** `docker compose up -d`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev`, then
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and put the printed `whsec_...` in `.env`.
- **Successful payment:** pay with `4242 4242 4242 4242`. The donation becomes SUCCEEDED and totals update
  (receipt in Mailpit at localhost:8025 from Day 4).
- **Declined payment:** pay with `4000 0000 0000 0002`. Stripe shows the decline; the row is FAILED,
  visible to staff and excluded from totals. Paying with another card on the same page makes it SUCCEEDED.
- **Amounts:** `250,50` is charged as R250,50; `250 50` is rejected.
- **Duplicates:**
  - double-click "Confirm and pay": one donation, one payment page
  - Back after a decline, edit, confirm again: the old page is closed
  - two tabs confirming at once: only the newer page can be paid
  - `stripe events resend <evt_id>`: no double count
- **Invalid campaign:** donating to a draft, closed or out-of-date campaign is rejected.
- **CM access:** a CM sees only their own campaigns. An anonymous donor shows as "Anonymous" in the page,
  the network response and the CSV. The same holds for the super admin.
- **Guest linking:** donate as a guest, then sign up with the same email. Nothing is linked until the
  verification link is clicked; after that the history appears.
- **Checks:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
