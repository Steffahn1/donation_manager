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

## Day 3: Staff dashboards (branch `day-3-dashboards`, pushed for a pull request)
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
- [ ] Check the dashboards against the seeded database (no database on this machine yet)

## Day 4: Donors
- [ ] Donor dashboard: history, campaign progress, total given, impact, anonymity toggle
- [ ] Signup with email verification; link guest donations after verification
- [ ] Receipt email (Mailpit) with private status link

## Day 5: Reporting and polish
- [ ] CSV export with date range for each role (donor counts must come from `computeMetrics`, never
      a separate count by donorId, or anonymous gifts become linkable again)
- [ ] Pacing chart (Recharts), using `Metrics.daily` from Day 3
- [ ] More tests (role guards)
- [ ] README: decisions, privacy, limitations, future work

## Known issues / notes
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
