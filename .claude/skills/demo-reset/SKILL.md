---
name: demo-reset
description: Reset the local demo environment. Starts Docker (Postgres + Mailpit), applies migrations, WIPES the database and reseeds it, then starts the dev server and Prisma Studio. Destructive, so only the user may run it.
disable-model-invocation: true
allowed-tools: Bash(docker compose *), Bash(npx prisma migrate deploy), Bash(npx prisma generate), Bash(npx prisma db seed), Bash(npm run dev), Bash(npx prisma studio --port 5555 --browser none), Bash(lsof *), Bash(readlink *), Bash(curl *), Bash(pgrep *), Bash(stripe listen --print-secret)
---

# /demo-reset

The user ran this on purpose to get a fresh demo database. It wipes ALL data in the local database
(donations, donors, accounts, campaigns). Never run it on your own initiative or suggest it as a fix.

Run from the project root. Stop at the first step that fails, show the error and don't carry on.

1. **Safety check.** Read `DATABASE_URL` from `.env` (don't print the password). If the host is not
   `localhost` or `127.0.0.1`, STOP and tell the user: this skill only resets the local Docker database.

2. **Start Docker.** Run `docker compose up -d`. Then wait until Postgres accepts connections:
   run `docker compose exec -T db pg_isready -U donations` up to 15 times, about 1 s apart
   (use `until ... ; do sleep 1; done` with a counter in one Bash call). If it never becomes ready, stop.

3. **Migrate.** Run `npx prisma migrate deploy` (applies the committed migrations without prompting),
   then `npx prisma generate` so the client matches the schema.

4. **Seed.** Run `npx prisma db seed`. This WIPES the database and creates the demo data.
   Show the seed's final "Seeded: ..." line.

5. **Dev server.** Check whether something already listens on port 3000 (`lsof -i :3000 -sTCP:LISTEN`).
   - If a dev server is already running, don't start a second one. Tell the user it's running and that it
     may need a restart if the schema changed.
   - Otherwise start `npm run dev` with `run_in_background`, then wait until `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
     returns 200 (up to about 30 s).

6. **Prisma Studio** (to show what's in the database). Check whether something already listens on port 5555
   (`lsof -ti :5555 -sTCP:LISTEN`).
   - If it's Prisma Studio from this project (`readlink /proc/<pid>/cwd` is the project root), don't start a second
     one; it shows the new data after a refresh in the browser.
   - If something else uses port 5555, don't start Studio and say so in the report.
   - Otherwise start `npx prisma studio --port 5555 --browser none` with `run_in_background`, then wait until
     `curl -s -o /dev/null -w "%{http_code}" http://localhost:5555` returns 200 (up to about 30 s).
     Always pass `--port 5555`: without it Prisma 7 picks a random port. `--browser none` stops it opening a tab.
   - A Studio problem doesn't stop the reset; just report it.

7. **Webhook check** (does not stop the reset; it only reports). Payments are only marked paid or failed
   if the webhook secret in `.env` matches the one `stripe listen` signs with. NEVER print either secret.
   Run this in one Bash call:

   ```bash
   cli=$(stripe listen --print-secret 2>/dev/null)
   env=$(grep -E '^STRIPE_WEBHOOK_SECRET=' .env | cut -d= -f2- | tr -d "\"'")
   case "$cli" in whsec_*) [ "$cli" = "$env" ] && echo "SECRET_MATCH" || echo "SECRET_MISMATCH";; *) echo "CLI_UNAVAILABLE";; esac
   pgrep -f "^stripe listen" >/dev/null && echo "LISTEN_RUNNING" || echo "LISTEN_NOT_RUNNING"
   ```

   - `SECRET_MATCH` + `LISTEN_RUNNING`: report "Payments ready: webhook secret matches and `stripe listen` is running."
   - `SECRET_MATCH` + `LISTEN_NOT_RUNNING`: the secret is fine, but tell the user to start
     `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in another terminal, or payments stay on "Processing".
   - `SECRET_MISMATCH`: warn clearly: every webhook will be rejected with `400 Invalid signature`, so payments stay
     `PENDING`. The fix is to put the secret from `stripe listen --print-secret` into `STRIPE_WEBHOOK_SECRET` in `.env`
     and restart `npm run dev` (it only reads `.env` at startup). Offer to do it; only change `.env` after the user says yes.
   - `CLI_UNAVAILABLE`: the Stripe CLI is missing or not logged in. Say payments can't complete until the user runs
     `stripe login` (they must do this themselves) and then re-checks; everything else in the demo works without it.

8. **Report** briefly:
   - App: http://localhost:3000 · Mailpit: http://localhost:8025 · Prisma Studio: http://localhost:5555
     (Studio can edit and delete rows: careful during a demo; `/demo-stop` stops it)
   - Demo logins (all made up): admin from `SEED_ADMIN_EMAIL` in `.env` (password not printed),
     `thandi@charity.local` / `johan@charity.local` (`Manager123!`), `donor@example.com` (`Donor123!`)
   - The webhook check result from step 7.
   - Old emails in Mailpit now point at deleted data; the user can clear the inbox in the Mailpit UI.

9. **Test card data.** Always end the report with this section, exactly as below (it's printed in the terminal
   so the user can test payments straight away). These are Stripe's public TEST card numbers: they only work in
   test mode and are not real card details.

   ### Test cards for the payment page (Stripe test mode)

   For every card: **any future expiry** (e.g. `12/34`), **any 3-digit CVC**, any postcode.
   Use made-up donor details, e.g. name `Test Donor`, email `test.donor@example.test`.

   **Pays successfully**
   | Card | What happens |
   |---|---|
   | `4242 4242 4242 4242` | Visa, paid immediately (use this for the demo) |
   | `5555 5555 5555 4444` | Mastercard, paid immediately |
   | `4000 0025 0000 3155` | 3-D Secure: click **Complete** on the test screen, then paid |

   **Declined** (donation becomes FAILED, never counted in totals)
   | Card | What happens |
   |---|---|
   | `4000 0000 0000 0002` | Generic decline |
   | `4000 0000 0000 9995` | Insufficient funds |
   | `4000 0000 0000 0069` | Expired card |
   | `4000 0000 0000 0127` | Incorrect CVC |
   | `4000 0084 0000 1629` | 3-D Secure passes, then declined |

   **Worth trying**
   - Decline, then retry: pay with `…0002`, then enter `4242…` on the same page. The same donation goes from
     FAILED to SUCCEEDED (one donation, not two).
   - Amount with a decimal comma, e.g. `250,50`, shows as R250,50 on the confirm step.
   - After a successful payment the receipt email appears in Mailpit (http://localhost:8025).
   - Without `stripe listen` running, payments stay on "Processing".
   - For a guided run that checks the database and Mailpit after each card, use `/test-payment-flow`.
