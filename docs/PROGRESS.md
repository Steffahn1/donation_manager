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

## Day 4: Donors (branch `day-4-donors`, pushed for a pull request)
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

## Day 5: Reporting and polish
- [ ] CSV export with date range for each role (donor counts must come from `computeMetrics`, never
      a separate count by donorId, or anonymous gifts become linkable again)
- [ ] Pacing chart (Recharts), using `Metrics.daily` from Day 3
- [ ] More tests (role guards)
- [ ] README: decisions, privacy, limitations, future work

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
- `getUserWithRole()` with no roles rejects everyone, unlike `requireRole()` (review #12, fix by Day 5).
