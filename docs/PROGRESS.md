# Progress

A day-by-day log of what was built, how it was checked and what is still open. Everything below is
merged into `main` (pull requests #1–#7).

**At a glance:** all five days of the brief are done, plus a visual redesign and documentation work.
236 unit tests; the payment flow was tested end to end with real Stripe test-mode webhooks; every role
was clicked through in the browser at desktop and phone width. Open items are under
[Known issues](#known-issues--notes) at the end.

## Day 1: Foundation
- [x] Next.js 16 + TypeScript + Tailwind scaffold; Docker Compose for Postgres and Mailpit
- [x] Prisma schema, init migration, seed (admin, 2 managers, 5 campaigns, 40 donors, 6 weeks of donations)
- [x] DB-backed sessions, bcrypt passwords, `requireRole`, proxy redirect
- [x] Privacy masking helper `toStaffDonation` (not used yet)
- [x] Public campaign list and detail pages
- [x] Super admin: create/edit campaigns, assign managers, create manager accounts

## Day 2: Stripe payments
- [x] Donate form with confirm step and non-refundable warning (`/donate/[slug]`)
- [x] Stripe Checkout Session with attempt-id idempotency key (migration `checkout_attempt`)
- [x] Webhook: completed / payment failed / expired, replay-safe via StripeEvent, forward-only status
- [x] Success page (read-only, polls for the webhook), cancelled page with "Try again"
- [x] Placeholder campaign images (re-seed to use them)
- [x] 9 unit tests for webhook logic; typecheck, lint and build pass
- [x] End-to-end test with a real database and the Stripe CLI: done on Day 5 (see "Real Stripe end-to-end test")

## Day 2 review fixes
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

## Day 3: Staff dashboards
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

## Day 4: Donors
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
- [x] Clicked through in a browser during the redesign; the receipt was triggered by a real Stripe
      webhook in the Day 5 end-to-end test

## Day 4 review fixes
- [x] Confirming locks the account before using up the link, the same order as deleting an account
      ("Add manager", cleanup), so the two can't deadlock; a signup for an account deleted meanwhile is
      skipped quietly
- [x] Login timing test now proves an account without a password is compared against the cost-12 dummy
- [x] 160 tests; typecheck and lint pass. Not re-run live (dev server was stopped); the same lock query
      already ran live in signup

## Day 5: Reporting and polish
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
- [x] Double-click on "Confirm and pay" tested by hand (2026-11-18): one donation, one Stripe payment
      page, browser went to Stripe (also covered by unit tests)
- [x] Dashboards and charts clicked through in a browser (during the redesign, every role)
- Note: the two Stripe test donations used a real email address. Both, and that donor record, were
  deleted from the dev database and Mailpit afterwards (the Stripe sandbox keeps its own test data:
  Dashboard → Developers → "Delete all test data").
- [x] Day 5 review fixes: README/PLAN accuracy, chart tooltips use formatZar, strict export-test
      helper, missing "from" counts back from "to", closed campaigns' charts end on their last day
      (a payment completed after midnight counts on that last day, so the chart's running total
      always equals "Raised"), clearer `getUserWithRole`, end-of-day boundary tests (202 tests total)

## Redesign: new visual design system
- Inspired by a bold charity website: navy / coral / yellow palette, Alfa Slab One numbers, Barlow
  Condensed uppercase headings, Lora reading text, chamfered buttons and badges, hatched stripe under
  campaign images, wavy dividers, hover lift and CSS-only scroll-in motion (off with reduced motion).
- `/campaigns` became the showcase page (hero, totals band, campaign cards). Then rolled out to every
  page: tokens and shared classes in `globals.css`, fonts loaded once in the root layout, new
  `CampaignCard` component (`/campaigns`; the home page later got its own preview card), restyled `ProgressBar`, `StatCard`, forms,
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
  mocked database (masking, scoping, donor-only). Follow-up review fix: donate-form amount errors now
  mark the "amount" input (the schema key is amountCents; mapped with DONATION_INPUT_NAMES). 220 tests.
- Note: CSS modules don't work in this project (`next.config.ts` runs all CSS through Tailwind as plain
  CSS); if styles stop updating in dev, delete `.next/dev` and restart.

## Documentation and onboarding
- README rewritten for first-time readers: prerequisites (Node 22.12+, Docker, Stripe only for
  payments), step-by-step setup, what works without Stripe keys, demo logins and test cards up front,
  screenshots, a design and accessibility section and a "How this was built" section.
- A fresh clone now works by following the README: `npm install` generates the Prisma client
  (`postinstall`; `prisma` is a regular dependency so this also works in production installs); it was
  gitignored and nothing created it, so `npm run dev` failed on a new machine. `engines` requires
  Node 22.12+ (what Prisma 7 and vitest need) and `.nvmrc` pins 24; `npm run typecheck` runs `next typegen` first so it also works on a
  fresh clone. Tested by cloning the GitHub repo into an empty folder and following the README.

- README restructured after a senior-developer-style review: "For reviewers: start here", key
  decisions near the top, detailed behaviour moved to `docs/ARCHITECTURE.md`, how accessibility was
  checked, "How this was built" focused on my decisions; reviewer agent renamed to `code-reviewer`;
  unused Stripe publishable key removed from `.env.example`; screenshots retaken from a production build.

## Campaign articles ("Learn more" pages)
- New optional `Campaign.story` column (migration `20261123120000_campaign_story`): a long-form article
  per campaign, shown on its public page under the description. The donate box stays in view (sticky)
  on wide screens while reading.
- Written by the super admin in the campaign form ("Article for the Learn more page"), with simple
  formatting (headings, paragraphs, bullet and numbered lists, quotes, bold) explained under the field.
  Rendered safely from parsed blocks (`src/lib/story.ts`, unit-tested), never as raw HTML.
- The campaign form now keeps everything entered when saving fails (text, article, Status and
  Campaign manager), so a long article isn't lost and a status change isn't silently undone.
- Made-up articles for all five demo campaigns in `prisma/seed-stories.ts` (structure based on
  common advice for charity campaign pages). Re-seed (`/demo-reset`) to load them.
- Review fixes: the article box states its 20 000-character limit and shows a character counter (a
  longer article is refused with a message, never cut off; line breaks count once on both sides);
  a `###` before the first `##` becomes `##` so headings never skip a level; campaign lists no longer
  load the article; seed article slugs are type-checked; Flood Relief copy mentions card fees.
- Follow-up review fixes: Status and Campaign manager dropdowns no longer jump back after a failed
  save (form rebuilt from the submitted values; checked in the browser); campaign form validation
  moved to `src/lib/campaign-form.ts` with tests for the article limit and the echoed values; the
  donate page and payment action no longer load the article; each seed slug is written once
  (`slugAndStory`); "danger on white" added to the design system's contrast table.
- Third review fixes: after a failed save, keyboard focus moves to the field with the problem (or
  the error message), and the character counter counts line breaks once for an untouched article.
- Future work: images inside articles (needs image upload first).
- Checked: typecheck, lint, 236 tests, build; every campaign page at desktop, 375px and 320px width
  with no sideways scroll; headings in order (one h1, then h2s).

## Landing page
- `/` is now a landing page instead of a copy of `/campaigns`: a light cream hero ("Small gifts. Real
  change.", with two campaign pictures on wide screens), how it works in 3 steps, up to 3 featured
  campaigns, "why give here" on a navy band (card details stay with Stripe, anonymous giving, only
  completed payments count) and a closing "Ready to help?" call to action.
- **No Donate buttons on `/`**: the featured previews (`CampaignPreviewCard`: the same card as on
  `/campaigns`, but with no Donate button and no status badge, since only open campaigns are shown)
  only link to each campaign's own page. Donating starts on
  `/campaigns` or a campaign page. No site-wide totals on `/` (they stay on `/campaigns`); each preview
  shows its own campaign's progress. The `/donate/[slug]` URL still works directly: the Donate buttons,
  "Try again" (after a cancelled payment) and "Start again" (expired payment page) all go there.
- Featured campaigns are chosen automatically, no schema change: only campaigns open for donations
  today, ending soonest first, at most 3. The database returns only today's open campaigns with the
  card's fields (`getFeaturedCampaigns` in `src/lib/queries/campaigns.ts`, filter `openCampaignsWhere`);
  `pickFeatured` orders them and keeps 3. Both are in `src/lib/campaigns.ts` and unit-tested (the
  filter is checked against `isAcceptingDonations` around the start and end dates). If none is open, the page says so.
  That part renders per request (`connection()` inside `<Suspense>`), so "open today" is never stale.
- "Track your giving" goes to `/signup`; a visitor who is already logged in is sent on from `/signup`
  to `/dashboard` (checked with a guest and a logged-in donor).
- Shared classes in `globals.css`, used by `/` and `/campaigns` (which looks the same): `full-bleed`,
  `band-inner`, `wave-divider`, `band-title`, `band-lead`, `dotted-bg`. `CampaignGrid` was removed
  (only the old home page used it).
- ESLint now ignores `.ua/` (the Understand Anything plugin's git-ignored output), which made
  `npm run lint` fail although it isn't project code.
- Review fixes: corrected this entry's list of what uses `/donate/[slug]`; preview cards got the
  impact chip and 3-line text back; copied styles became the shared classes above, and font sizes
  follow the design system's scale; the featured query only loads open campaigns and the card's
  fields; a real test that the caller's list isn't reordered; the `<img>` lint exception covers only
  the two decorative pictures; both hero buttons are the same size; no hairline between the waves
  and the navy band.
- Second review fixes: the kicker size and the navy band's text colour (white 85%) are in the design
  system; "Track your giving" fills navy on hover (cream didn't show on the cream hero); both campaign
  cards share one date format (`formatCampaignDay`); the open-today database filter has its own tests.
- Checked: typecheck, lint, 242 tests, build, `/access-review` PASS; in the rendered HTML: one h1,
  then h2s and h3s; no `/donate/` links on `/`; Donate buttons still on `/campaigns`.
- **Still open: a look in the browser** (desktop, 375px and 320px, tabbing through the focus rings).
  The browser extension wasn't connected while this was built.

## Known issues / notes
- No rate limit on signup: someone could trigger many verification emails to one address.
- Tokens in URLs (`/verify-email?token=…`, `/receipt/<token>`) can show up in hosting access logs.
- A receipt whose email failed is not retried (best effort, by decision); its link is lost.
- Blocked staff pages (another manager's campaign, or a donor opening a staff page) return HTTP 200
  with the "not found" page or a client-side redirect, instead of a 404/redirect status. No data
  leaks; the status is already sent because the page streams (root loading.tsx) before the access
  check runs. Fix by checking access before streaming starts, if status codes start to matter.
- Expired sessions are rejected but never deleted from the database.
- Several declines on one Checkout page keep only the latest failure reason.
- A donation whose payment page could never be opened (Stripe unreachable) stays PENDING with no
  session id. It is never counted: staff views only list paid and declined donations, and donor
  history hides PENDING rows without a payment page (`visibleDonations` in `src/lib/donor-summary.ts`).
- "Newest page wins" is per browser: a donor using two different browsers can still have two open
  payment pages for the same campaign. Both would be deliberate confirm steps.
- Dashboard metrics load successful donations into memory (fine for a small charity; move to SQL
  aggregation if volumes grow a lot).

### Development-only warnings (`npm run dev`, not in production builds)
These come from Next.js 16's development checks; pages and data are correct, and `npm run build` passes.
- "encountered uncached data during prerendering or a navigation" on logged-in and dynamic routes
  (`/dashboard`, `/admin/*`, `/campaigns/[slug]`, `/donate/[slug]`): these pages read the database or
  the session per request, which the dev check flags as "not instantly navigable". Fix later by moving
  each page's data loading inside its own `<Suspense>` boundary.
- "InvariantError: Received an underlying cookies object…" only when a form is submitted with
  JavaScript turned off and the action returns an error (e.g. wrong password); the page and message
  still render. Normal submissions don't take this path.
