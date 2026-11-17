---
name: demo-reset
description: Reset the local demo environment. Starts Docker (Postgres + Mailpit), applies migrations, WIPES the database and reseeds it, then starts the dev server. Destructive, so only the user may run it.
disable-model-invocation: true
allowed-tools: Bash(docker compose *), Bash(npx prisma migrate deploy), Bash(npx prisma generate), Bash(npx prisma db seed), Bash(npm run dev), Bash(lsof *), Bash(curl *)
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

6. **Report** briefly:
   - App: http://localhost:3000 · Mailpit: http://localhost:8025
   - Demo logins (all made up): admin from `SEED_ADMIN_EMAIL` in `.env` (password not printed),
     `thandi@charity.local` / `johan@charity.local` (`Manager123!`), `donor@example.com` (`Donor123!`)
   - Reminder: for payments to complete, run
     `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in another terminal.
   - Old emails in Mailpit now point at deleted data; the user can clear the inbox in the Mailpit UI.
