# Progress

## Day 1: Foundation (committed: 21e3862)
- [x] Next.js 16 + TypeScript + Tailwind scaffold; Docker Compose for Postgres and Mailpit
- [x] Prisma schema, init migration, seed (admin, 2 managers, 5 campaigns, 40 donors, 6 weeks of donations)
- [x] DB-backed sessions, bcrypt passwords, `requireRole`, proxy redirect
- [x] Privacy masking helper `toStaffDonation` (not used yet)
- [x] Public campaign list and detail pages
- [x] Super admin: create/edit campaigns, assign managers, create manager accounts

## Day 2: Stripe payments (committed)
- [x] Donate form with confirm step and non-refundable warning (`/donate/[slug]`)
- [x] Stripe Checkout Session with attempt-id idempotency key (migration `checkout_attempt`)
- [x] Webhook: completed / payment failed / expired, replay-safe via StripeEvent, forward-only status
- [x] Success page (read-only, polls for the webhook), cancelled page with "Try again"
- [x] Placeholder campaign images (re-seed to use them)
- [x] 9 unit tests for webhook logic; typecheck, lint and build pass
- [ ] End-to-end test with a real database and the Stripe CLI (not available yet on this machine)

## Review fixes (after Day 2, not committed yet)
- [x] Amount parsing accepts the South African decimal comma ("250,50" was read as R25 050)
- [x] Double payments: a donation keeps one payment page (reused after a decline); per browser and
      campaign only the newest OPEN page stays payable (random `dm_browser` cookie set at the review
      step, never matched by email; hash cleared once no page can be open); logic in
      src/lib/checkout-flow.ts with unit tests, including two tabs pressing Confirm at once
- [x] Each donation stores the name typed for it (`donorName`); staff see that, confirm screen matches
- [x] Stripe outages leave the donation PENDING (not FAILED); "press again" only when it can work,
      otherwise back to review; logs contain no error messages (`errorSummary`)
- [x] Success page never says "not charged" while waiting for the webhook after a decline + retry
- [x] Admin form: amount cap, real-date check, slug collision retry
- [x] Webhook: only a duplicate event id counts as "duplicate"; typed DB adapter instead of a cast
- [x] "Try again" and the success/cancelled pages accept only test-mode session ids
- [x] Receipt links: column is now `receiptTokenHash` (nullable, set when the receipt email is sent)
- [x] No receipt-email promise until Day 4; slugify turns accented letters into plain ones ("è" -> "e")
- [x] Amount parsing: spaces only allowed between groups of 3 digits ("250 50" is rejected)
- [x] Tests: money, donation limits, privacy masking, campaign dates/scope, checkout flow, Stripe helpers,
      webhook (96 tests)
- Migration `donor_name_receipt_hash` (also adds `browserKeyHash`): run `npx prisma migrate dev`, then re-seed

## Day 3: Staff dashboards (merged in pull request #2)
- [x] Shared metrics in src/lib/metrics.ts (pure, unit tested): gross raised, donations, unique and
      repeat donors, this week vs last week, new vs returning (per campaign), 28-day daily series for
      the Day 5 chart. Johannesburg days, weeks start Monday. Only SUCCEEDED counts. Each anonymous
      gift counts as its own donor, so the numbers can't link it to the donor's named gifts.
- [x] Staff queries in src/lib/queries/staff.ts, all scoped with `campaignScopeFor`; donation rows
      masked with `toStaffDonation`
- [x] `/dashboard`: super admin sees all campaigns + manager list; a campaign manager sees only theirs;
      donors get a placeholder until Day 4
- [x] `/dashboard/campaigns/[id]`: progress, key numbers, donor list (latest 50, masked), failed
      attempts (latest 50, masked). Another manager's campaign is "not found".
- [x] Review fixes: anonymous gifts counted separately, linear-time grouping, clearer labels
- [x] 16 metrics tests (112 tests in total); typecheck, lint and build pass
- [x] Checked against the seeded database (2026-11-14): each role sees only its campaigns; totals,
      donation, failed and donor counts match SQL; another manager's campaign shows "not found"
      with no data; anonymous gifts show as "Anonymous" and no anonymous donor's email or id
      appears in the page or its RSC payload

## Day 4: Donors (merged in pull request #3)
- [x] Donor dashboard: history (attempts that never reached Stripe hidden), campaign progress, total
      given, impact per campaign, "Show my name" on anonymous gifts (one-way, with a confirmation; a
      named gift can never be made anonymous afterwards)
- [x] Signup with email verification: signup takes the email only and always answers the same way at
      once (lookup and email run after the response); the link opens a page where the inbox owner
      chooses name and password and confirms (email scanners can't verify); confirming ends all other
      sessions and links guest donations; links last 24 h and work once; unconfirmed accounts have no
      password and can't log in
- [x] Review fixes: account pre-hijack closed, signup timing equalised, no user text in the
      verification email, reveal only on own PAID anonymous gifts with tested decision logic
- [x] Follow-up fixes: links used up atomically (two simultaneous confirms can't both succeed); login
      runs the same slow check for unknown emails and refuses unconfirmed donors (src/lib/login.ts);
      concurrent signups for one email leave one valid link; unconfirmed signups deleted after 24 h;
      "Add manager" replaces an unconfirmed signup with that email
- [x] Receipt email after the webhook marks a donation paid, sent once (hash claimed first) and
      after the webhook response (`after()`); best effort. Private `/receipt/[token]` page (noindex,
      no-referrer) with status, amount, date, name given, anonymity and campaign progress
- Migration `password_after_verification` (User.passwordHash optional): run `npx prisma migrate dev`
- [x] Tests: emails, verification and the confirm step (incl. account created by someone else),
      donor summary, reveal, login, receipt sending (158 total)
- [x] Checked against the database + Mailpit (2026-11-14): signup (new, existing and invalid), unverified
      dashboard, confirm link (opening it changes nothing; works once), linked history and totals,
      reveal (only own anonymous gifts, one-way), receipt sent once and page contents. Test data removed.
- [ ] Not yet clicked through in a browser; the receipt has not been triggered by a real Stripe
      webhook (no Stripe CLI on this machine)

## Day 4 review fixes (branch `day-4-review-fixes`)
- [x] Confirming locks the account before using up the link, the same order as deleting an account
      ("Add manager", cleanup), so the two can't deadlock; a signup for an account deleted meanwhile is
      skipped quietly
- [x] Login timing test now proves an account without a password is compared against the cost-12 dummy
- [x] 160 tests; typecheck and lint pass. Not re-run live (dev server was stopped); the same lock query
      already ran live in signup

## Day 5: Reporting and polish (branch `day-5-reporting`, pushed for a pull request)
- [x] CSV exports with a date range, paid donations only: staff (`/api/export/donations.csv`, scoped
      with `campaignScopeFor`, anonymous donors masked, empty file for another manager's campaign) and
      donors (`/api/export/my-donations.csv`, own donations). Formula-injection safe, BOM + CRLF,
      401/403 via `getUserWithRole`, which now treats "no roles" as "any logged-in user"
- [x] Charts (Recharts): long-term (per day + running total since the start) and week by week (last
      8 weeks), on the overview and each campaign page; only dates, amounts and donation counts
      reach the browser; a closed campaign's chart ends on its last day
- [x] Tests: CSV, date ranges, exports per role (filter applied to in-memory rows), access rules,
      long-term and weekly series
- [x] Checked against the seeded database: 401/403/400 responses; admin CSV = all 119 paid donations
      (R62 750), manager CSV = only their 72, other manager's campaign = empty, donor CSV = own 4;
      all 21 anonymous rows masked; chart data matches totals and contains no donor details
- [x] README write-up: roles, reporting, key decisions, privacy, limitations, future work
- [x] Real Stripe end-to-end test (2026-11-15, Stripe CLI `stripe listen`, test mode sandbox, paid in
      a real browser):
      - card 4242: donation SUCCEEDED only via `checkout.session.completed`; campaign total +R100;
        one receipt email in Mailpit; the private receipt link shows the right details
      - `stripe events resend` of that event: logged as "duplicate", no double count, no second receipt
      - card 4000…0002: `payment_intent.payment_failed` set FAILED with "Your card was declined.";
        not counted; shown as a failed attempt
      - back to the form after the decline and confirming again: no second donation, no second
        payment page (the open page was reused)
      - "Try again": Stripe page expired (checked at Stripe); donation stayed FAILED; browser key cleared
- [ ] Not tested by hand: a deliberate double-click on "Confirm and pay" (covered by unit tests)
- [ ] Click-through in a browser of the dashboards, including how the charts look
- Note: the two Stripe test donations used a real email address. Both, and that donor record, were
  deleted from the dev database and Mailpit afterwards (the Stripe sandbox keeps its own test data:
  Dashboard → Developers → "Delete all test data").
- [x] Day 5 review fixes: README/PLAN accuracy, chart tooltips use formatZar, strict export-test
      helper, missing "from" counts back from "to", closed campaigns' charts end on their last day
      (a payment completed after midnight counts on that last day, so the chart's running total
      always equals "Raised"), clearer `getUserWithRole`, end-of-day boundary tests (202 tests total)

## Redesign: new visual design system (branch `campaigns-redesign`)
- Inspired by a bold charity website: navy / coral / yellow palette, Alfa Slab One numbers, Barlow
  Condensed uppercase headings, Lora reading text, chamfered buttons and badges, hatched stripe under
  campaign images, wavy dividers, hover lift and CSS-only scroll-in motion (off with reduced motion).
- `/campaigns` became the showcase page (hero, totals band, campaign cards). Then rolled out to every
  page: tokens and shared classes in `globals.css`, fonts loaded once in the root layout, new
  `CampaignCard` component (home page and `/campaigns`), restyled `ProgressBar`, `StatCard`, forms,
  tables, badges and charts. Behaviour, data loading and privacy rules unchanged.
- Rules live in the `/ui-design-system` skill (`.claude/skills/ui-design-system/SKILL.md`).
- Accessibility: contrast checked for every colour pair (WCAG AA), visible focus ring on every control
  (chamfered buttons drop their clip while focused), skip link, every input has a visible label and
  linked help text, `scope="col"` table headers, named progress bars, no sideways scroll at 375px.
- Also on this branch: `/access-review` (PASS), CSV export queries moved into `src/lib/queries/`.
- Checked: typecheck, lint, 202 tests, production build; every page looked at in the browser as guest,
  donor, campaign manager and super admin, at desktop and phone width.
- Review fixes (reviewer: ready to push, 1 should-fix + 5 minor, all fixed): upcoming campaigns show
  "Starts {date}" instead of "Closed" (`campaignAvailability`, tested); coral amounts on the donate page
  sit on a white card; stand-alone links are 44px tall (`.tap`); `<main>` padding is a variable the
  full-width page cancels; every form says which fields are required, server actions return the failing
  field and inputs get `aria-invalid` (`src/lib/form-errors.ts`, tested); export queries tested with a
  mocked database (masking, scoping, donor-only). 217 tests.
- Note: CSS modules don't work in this project (`next.config.ts` runs all CSS through Tailwind as plain
  CSS); if styles stop updating in dev, delete `.next/dev` and restart.

## Known issues / notes
- No rate limit on signup: someone could trigger many verification emails to one address.
- Next.js dev logs "InvariantError: Received an underlying cookies object…" when a form is submitted
  WITHOUT JavaScript and the action returns an error message (e.g. wrong password). The page and the
  error message still render correctly; normal (JavaScript) submissions don't take this path.
- Tokens in URLs (`/verify-email?token=…`, `/receipt/<token>`) can show up in hosting access logs.
- A receipt whose email failed is not retried (best effort, by decision); its link is lost.
- Blocked staff pages (another manager's campaign, or a donor opening a staff page) return HTTP 200
  with the "not found" page or a client-side redirect, instead of a 404/redirect status. No data
  leaks; the status is already sent because the page streams (root loading.tsx) before the access
  check runs. Fix by checking access before streaming starts, if status codes start to matter.
- Expired sessions are rejected but never deleted from the database.
- Several declines on one Checkout page keep only the latest failure reason.
- A donation whose payment page could never be opened (Stripe unreachable) stays PENDING with no
  session id. It is never counted. Day 3 staff views AND Day 4 donor history must filter out PENDING
  rows without a session id (they are not real payments).
- "Newest page wins" is per browser: a donor using two different browsers can still have two open
  payment pages for the same campaign. Both would be deliberate confirm steps.
- Dashboard metrics load successful donations into memory (fine for a small charity; move to SQL
  aggregation if volumes grow a lot).
- ~~`getUserWithRole()` with no roles rejects everyone~~: fixed on Day 5 (shared `hasRole` rule).
- Next.js dev logs "encountered uncached data during prerendering or a navigation" on several logged-in
  and dynamic routes (`/dashboard`, `/admin/*`, `/campaigns/[slug]`, `/donate/[slug]`). Dev-only warning
  from instant-navigation checks; pages render correctly. Not caused by the redesign.
