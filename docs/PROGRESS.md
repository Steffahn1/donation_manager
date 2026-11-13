# Progress

## Day 1: Foundation (committed: 21e3862)
- [x] Next.js 16 + TypeScript + Tailwind scaffold; Docker Compose for Postgres and Mailpit
- [x] Prisma schema, init migration, seed (admin, 2 managers, 5 campaigns, 40 donors, 6 weeks of donations)
- [x] DB-backed sessions, bcrypt passwords, `requireRole`, proxy redirect
- [x] Privacy masking helper `toStaffDonation` (not used yet)
- [x] Public campaign list and detail pages
- [x] Super admin: create/edit campaigns, assign managers, create manager accounts

## Day 2: Stripe payments (not committed yet)
- [x] Donate form with confirm step and non-refundable warning (`/donate/[slug]`)
- [x] Stripe Checkout Session with attempt-id idempotency key (migration `checkout_attempt`)
- [x] Webhook: completed / payment failed / expired, replay-safe via StripeEvent, forward-only status
- [x] Success page (read-only, polls for the webhook), cancelled page with "Try again"
- [x] Placeholder campaign images (re-seed to use them)
- [x] 9 unit tests for webhook logic; typecheck, lint and build pass
- [ ] End-to-end test with a real database and the Stripe CLI (not available yet on this machine)

## Day 3: Staff dashboards
- [ ] Shared metrics (totals, unique donors, new vs returning, daily series)
- [ ] Campaign manager dashboard: progress, donor list (masked), failed attempts
- [ ] Super admin dashboard: all campaigns, per-campaign summary, manager list

## Day 4: Donors
- [ ] Donor dashboard: history, campaign progress, total given, impact, anonymity toggle
- [ ] Signup with email verification; link guest donations after verification
- [ ] Receipt email (Mailpit) with private status link

## Day 5: Reporting and polish
- [ ] CSV export with date range for each role
- [ ] Pacing chart (Recharts)
- [ ] More tests (masking, metrics, role guards)
- [ ] README: decisions, privacy, limitations, future work

## Known issues / notes
- Expired sessions are rejected but never deleted from the database.
- Several declines on one Checkout page keep only the latest failure reason.
