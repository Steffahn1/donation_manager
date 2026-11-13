# Donation Manager

Donation management for a small charity: public campaign pages, once-off card donations through
Stripe (test mode), and staff accounts (super admin and campaign managers). Currency is ZAR only.

> Work in progress. The full write-up (decisions, privacy, limitations, future work) comes on day 5.

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

Checks: `npm test`, `npm run typecheck`, `npm run lint`.

## How a donation is paid

1. **Details** (`/donate/[slug]`): amount, name, email, "give anonymously". Validated on the server; the
   campaign must be `ACTIVE` and today within its dates.
2. **Please confirm**: a summary with a warning that accidental donations cannot be refunded. Nothing
   is stored before this step.
3. **Confirm and pay**: creates a `PENDING` donation and a hosted Stripe Checkout Session, then
   redirects to Stripe. We never see card details.
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
- Checkout Sessions expire an hour after they are created, so an old payment tab can't be paid much later.
- Every processed webhook event id is stored in `StripeEvent` in the same transaction as the donation
  update. A redelivered or replayed event is ignored.
- Status updates are conditional (`WHERE status IN (...)`), so a late or out-of-order event never
  downgrades a `SUCCEEDED` donation.

Test cards: `4242 4242 4242 4242` (succeeds), `4000 0000 0000 0002` (declined),
`4000 0000 0000 9995` (insufficient funds). Any future expiry date and any CVC.
