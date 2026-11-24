---
name: demo-stop
description: Stop everything the local demo runs - the Next.js dev server, stripe listen, Prisma Studio and the Docker containers (Postgres + Mailpit). Keeps all data. The counterpart of /demo-reset; only the user may run it.
disable-model-invocation: true
allowed-tools: Bash(pgrep *), Bash(lsof *), Bash(kill *), Bash(readlink *), Bash(docker compose stop), Bash(docker compose ps *)
---

# /demo-stop

The user ran this on purpose to shut the local demo down (after a demo or a practice run). Never run it on
your own initiative or as a fix for something else. It stops processes; it does NOT delete anything.

Run from the project root. Only ever touch THIS project's processes and containers.

## Rules
- **Never delete data:** use `docker compose stop`, never `docker compose down -v`, `docker rm`, `docker volume rm`
  or `docker system prune`. The database and Mailpit inbox must still be there for the next `/demo-reset`
  or `docker compose up -d`.
- **Never kill by a broad name** (`pkill node`, `killall next`, `pkill -f stripe`): the user may run other apps.
  Match processes by how their command line starts, and check they run from this project folder.
- **Stop gently first:** `kill` (SIGTERM), wait, and only use `kill -9` for a process that is still running
  after about 5 seconds.
- If a dev server was started in this Claude session as a background task, stop it with TaskStop instead of `kill`.

## Steps

1. **Find what is running** (one Bash call; `R` is the project root):

   ```bash
   R=$(pwd -P)
   echo "DEV:";    pgrep -f "^node $R/node_modules/.bin/next dev"
   echo "PORT:";   for p in $(lsof -ti :3000 -sTCP:LISTEN); do [ "$(readlink /proc/$p/cwd)" = "$R" ] && echo $p; done
   echo "STRIPE:"; pgrep -f "^stripe listen .*localhost:3000/api/webhooks/stripe"
   echo "STUDIO:"; for p in $(pgrep -f "^node .*prisma studio"); do [ "$(readlink /proc/$p/cwd)" = "$R" ] && echo $p; done
   echo "DOCKER:"; docker compose ps --format '{{.Name}} {{.State}}'
   ```

   - Something on port 3000 that is NOT from this project folder: leave it alone and mention it in the report.

2. **Stop the dev server:** `kill` the `next dev` process(es) from step 1, then any remaining port-3000 process from
   step 1 (the `next-server` child usually exits with its parent).

3. **Stop `stripe listen`:** `kill` the process(es) found in step 1.

4. **Stop Prisma Studio** if it was running.

5. **Stop the containers:** `docker compose stop` (Postgres and Mailpit; data is kept).

6. **Check:** re-run the step 1 commands. Everything should be empty and the containers should show `exited`.
   Use `kill -9` only on a process from this project that ignored SIGTERM.

7. **Report** briefly, as a short list: what was stopped (dev server, stripe listen, Prisma Studio, Postgres,
   Mailpit), what was already off, and anything left alone because it wasn't from this project. End with:
   - Data is kept. To start again: `/demo-reset` (fresh demo data), or `docker compose up -d` + `npm run dev`
     to continue with the current data, plus `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
     for payments (and `npx prisma studio --port 5555` to browse the data).
