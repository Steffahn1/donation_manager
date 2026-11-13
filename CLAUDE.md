# Donation Manager

Charity donation app: public campaigns, once-off card donations via Stripe Checkout (TEST mode only),
staff dashboards. Next.js 16 (App Router, cacheComponents on), React 19, TypeScript, Prisma 7 + Postgres,
Tailwind 4, zod, vitest. Currency: ZAR only.

Next.js 16 has breaking changes. Read node_modules/next/dist/docs/ before writing Next.js code:
@AGENTS.md

Plan (requirements, design, build order): docs/PLAN.md. Progress and what's next: docs/PROGRESS.md

## Commands
- `docker compose up -d`: Postgres + Mailpit (inbox: http://localhost:8025)
- `npx prisma migrate dev` / `npx prisma db seed` (the seed WIPES the database)
- `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
- Webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## Roles
SUPER_ADMIN (sees everything), CAMPAIGN_MANAGER (only campaigns where managerId = their id),
DONOR (own donations only). Guests can donate without an account.

## Payments
- **Money**: integer cents (`*Cents` fields), never floats. Parse input with `parseRandToCents`,
  display with `formatZar` (src/lib/money.ts).
- **Paid status**: only the Stripe webhook (src/lib/stripe-webhook.ts) may set a donation to SUCCEEDED.
  Pages and actions never mark donations paid.
- **Totals**: only SUCCEEDED donations count in any total, count or chart. FAILED, PENDING and EXPIRED never do.
- **Duplicates**: Checkout Sessions are created with the confirm-step attempt id as the idempotency key;
  webhook events are recorded in StripeEvent in the same transaction as the update; status updates
  are conditional (`updateMany` with `status: { in: [...] }`).

## Access
- Every protected page, Server Action and Route Handler calls `requireRole(...)`
  (or `getUserWithRole` in Route Handlers). Scope campaign queries with `campaignScopeFor(user)`.
- proxy.ts is only an optimistic redirect, not security.

## Donor privacy
- Only use made-up data. Never real names, emails or card details.
- Never store card details at all (Stripe holds them).
- Never put donor names or emails in logs, error messages or URLs.
- Public pages never show donor details.
- Anonymous donations are masked for all staff: any donation data shown to staff (pages AND CSVs)
  goes through `toStaffDonation` (src/lib/privacy.ts), on the server.

## Conventions
- Server components by default; client components only for interactivity.
- Validate all form input on the server with zod; return `{ error }` state to forms via useActionState.
- No `any`. No ignored errors.
- `redirect()` throws: never call it inside try/catch.
- DB queries live in src/lib/queries/ and are server-only.
- Unit-test payment and privacy logic (vitest, `*.test.ts` next to the file).
- Secrets live in `.env` (not committed; Prisma and the seed load it via dotenv). Add new keys to
  `.env.example` without real values. The Stripe key must be a `sk_test_` key.
- Schema changes: edit prisma/schema.prisma, add a migration, run `npx prisma generate`.
  The generated client in src/generated/prisma is never edited by hand.

## How to work
- For any new feature, plan first and wait for approval.
- Before saying a task is done, run typecheck, lint and tests, and fix what fails.
- Never commit or push; I do that after reviewing.
- After a feature is done, update docs/PROGRESS.md.
- When unsure about a product decision, ask me. Don't guess.
