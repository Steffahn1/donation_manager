---
name: test-payment-flow
description: Guided end-to-end test of Stripe Checkout with Stripe's test cards. The user pays in the browser; after each card Claude checks the donation in the database, the webhook events and the Mailpit inbox, and reports pass or fail. Creates test donations, so only the user may run it.
disable-model-invocation: true
allowed-tools: Bash(docker compose exec -T db psql *), Bash(curl *), Bash(stripe events *), Bash(stripe checkout sessions *), Bash(lsof *), Bash(grep *)
---

# /test-payment-flow

An interactive test of the payment flow. The user enters the cards on Stripe's hosted page; you check the
results. Stripe TEST mode only.

**Rules**
- Only made-up data. Use the emails below (`@example.test`) and the `Pay Test` names. Never real data.
- Never change the database or code. This skill only reads. If a check fails, report it and ask before fixing.
- If `STRIPE_SECRET_KEY` in `.env` doesn't start with `sk_test_`, STOP. Don't print the key.

## Helpers

Database (read-only queries):
```
docker compose exec -T db psql -U donations -d donations -c "<SQL>"
```
Find a test donation by its email:
```sql
SELECT d.id, d.status, d."amountCents", d."isAnonymous", d."failureReason", d."paidAt",
       d."stripeCheckoutSessionId" IS NOT NULL AS has_session,
       d."stripePaymentIntentId" IS NOT NULL AS has_intent,
       d."receiptTokenHash" IS NOT NULL AS receipt_sent
FROM "Donation" d JOIN "Donor" o ON o.id = d."donorId"
WHERE o.email = '<email>' ORDER BY d."createdAt";
```
Mailpit: `curl -s 'http://localhost:8025/api/v1/search?query=to:<email>'` (look at `messages_count`, `Subject`).

## 0. Preflight

Check, and tell the user what's missing:
1. Postgres and Mailpit run: `docker compose exec -T db psql ... -c "select 1"` and `curl -s localhost:8025/api/v1/info`.
2. The dev server is on port 3000: `lsof -i :3000 -sTCP:LISTEN`.
3. `stripe listen --forward-to localhost:3000/api/webhooks/stripe` is running in a terminal. You can't see it,
   so ask the user to confirm. Without it, nothing leaves PENDING.
4. Note `SELECT count(*) FROM "StripeEvent"` as the starting point.

## 1. Run the scenarios, one at a time

For each scenario, tell the user exactly what to do, then wait for them to say "done":

> Go to http://localhost:3000/campaigns → **Winter Food Parcels** → Donate. Amount **R<amount>**,
> name **Pay Test <n>**, email **<email>**<, tick Anonymous>. Pay with **<card>**, any future expiry
> (e.g. 12/34), any CVC, any postcode. Tell me when you're done.

Then wait about 3 seconds for the webhook and run the checks. Show the result as ✅ / ❌ per check before
moving on.

| # | Card | Email | Amount | What the user does | Expected |
|---|---|---|---|---|---|
| 1 | `4242 4242 4242 4242` (success) | `pay-test-1@example.test` | `250,50` (decimal comma) | Pays; tick **Anonymous** | `SUCCEEDED`, `amountCents = 25050`, `isAnonymous = true`, `paidAt` set, has_intent, `receipt_sent`; **1** email "Thank you for your donation of R250,50" |
| 2 | `4000 0000 0000 0002` (generic decline) | `pay-test-2@example.test` | `100` | Pays, sees the decline, then closes the tab | `FAILED` with a `failureReason`, `paidAt` null, no receipt; **0** emails |
| 3 | `4000 0000 0000 9995` (insufficient funds) then `4242…` | `pay-test-3@example.test` | `75` | First card is declined; **on the same page** retries with 4242 | Ends `SUCCEEDED`, `failureReason` null, **one** donation row (not two), **1** receipt email |
| 4 | `4000 0025 0000 3155` (3-D Secure) | `pay-test-4@example.test` | `120` | Clicks **Complete** on the authentication screen | `SUCCEEDED`, **1** receipt email |
| 5 | `4000 0084 0000 1629` (3-D Secure, then declined) | `pay-test-5@example.test` | `60` | Completes authentication; the card is then declined | `FAILED`, **0** emails |
| 6 | none (expired page) | `pay-test-6@example.test` | `40` | Reaches the Stripe page, then tells you without paying | You expire it: `stripe checkout sessions expire <session id>` (read the id from the DB as `stripeCheckoutSessionId`). Expect `EXPIRED`, **0** emails |

**After scenario 1, also test duplicate protection:**
- Webhook replay: `stripe events list --limit 5` to find the `checkout.session.completed` event for
  scenario 1, then `stripe events resend <evt id>`. Expect the donation unchanged (`paidAt` unchanged),
  still **1** receipt email, and the `StripeEvent` count unchanged (the duplicate is ignored).
- Double payment: ask the user to press **Back** to the confirm page and submit again. Expect no second
  `SUCCEEDED` row for `pay-test-1@example.test`.

**Check after every scenario:**
- No donation for that email in an unexpected status. Totals only count `SUCCEEDED`; check the campaign's
  public total went up only for successful scenarios.
- Emails only go to the address used. Nothing for other addresses.

## 2. Report

A summary table: scenario, card, expected, actual, ✅/❌. Then:
- for each ❌: what was expected, what the database or Mailpit showed, and the likely place in the code
  (`src/lib/stripe-webhook.ts`, `src/lib/checkout-flow.ts`, `src/lib/receipt-sender.ts`) — without changing it;
- the test rows left behind (all `@example.test`). Tell the user they're removed by `/demo-reset` (which wipes
  the database) and that Mailpit can be cleared in its UI. Don't delete anything yourself.
