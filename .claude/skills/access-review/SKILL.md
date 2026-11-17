---
name: access-review
description: Security audit of the app's access control. Goes through every page, Server Action and Route Handler and reports in a table whether each one checks the role (requireRole / getUserWithRole), scopes campaigns (campaignScopeFor) and masks anonymous donors (toStaffDonation). Use before committing or before a demo. Read-only.
allowed-tools: Read, Grep, Glob, Bash(find *), Bash(git diff *), Bash(git status *)
---

# /access-review

A read-only security audit. **Never edit files.** Report what you find; fixes are a separate step the user
approves.

The rules being checked come from CLAUDE.md ("Access" and "Donor privacy"). Read CLAUDE.md first.

## 1. Build the inventory

Find every entry point. Don't rely on a fixed list; the app may have grown.

- **Pages:** `find src/app -name page.tsx`
- **Route Handlers:** `find src/app -name route.ts`
- **Server Actions:** every exported async function in files with `"use server"`
  (`grep -rln '"use server"' src`). One row per action, not per file.

Also note `src/proxy.ts`: it is only an optimistic redirect and NEVER counts as an access check.

## 2. Check each entry point

Follow the call chain: page → components it renders (e.g. `src/components/dashboard/*`) → queries in
`src/lib/queries/*`. A check counts wherever it happens on the server path, but it must happen **before** any
protected data is loaded.

For each entry point, decide these three things:

**A. Access check.**
- Protected pages and Server Actions call `requireRole(...)` from `src/lib/auth.ts`.
- Route Handlers call `getUserWithRole(...)`, return 401/403 when it fails, and do it before any query.
- Check that the roles passed are right for what the code does. Admin-only things need `SUPER_ADMIN`, and a
  campaign manager must not reach admin actions.
- Some entry points are public on purpose. Each needs its own protection instead:
  - `/`, `/campaigns`, `/campaigns/[slug]`: must show no donor names or emails, never DRAFT campaigns (CLOSED ones are
    shown, marked closed and without a Donate button), and
    totals from SUCCEEDED donations only.
  - `/donate/*` and the donate action: guests may donate. They must never mark a donation paid, and the
    amount must be parsed on the server with `parseRandToCents`.
  - `/login`, `/signup`, `/signup/check-email`, `/verify-email` and the auth/account actions: must not reveal
    whether an email has an account (same response and same timing).
  - `/receipt/[token]`: looks the donation up by the SHA-256 hash of the token only, and shows nothing more
    than the receipt.
  - `/api/webhooks/stripe`: has no user, so it must verify the Stripe signature before doing anything. It is
    the only code allowed to set `SUCCEEDED`.

**B. Campaign scope.** Every query that loads campaigns, or donations by campaign, for staff uses
`campaignScopeFor(user)`. Look for any lookup by id from the URL or the form (`params.id`, `campaignId`) that
skips the scope; that's an IDOR. Donor-facing queries must filter by the donor linked to the logged-in user,
never by an id or email taken from the request.

**C. Anonymous masking.** Any donation data shown to staff (pages AND CSV exports) goes through
`toStaffDonation` (`src/lib/privacy.ts`). Watch for:
- a raw `donorName`, `donor.name` or `donor.email` reaching a staff page or export;
- staff counts that group anonymous gifts under the real donor (these must come from `computeMetrics`).

Write "n/a" where a column doesn't apply (e.g. masking on a page that shows no donations).

## 3. Also sweep the whole of `src/` for

- donor names or emails in `console.*`, thrown error messages, or URLs and query strings;
- `status: "SUCCEEDED"` written anywhere except `src/lib/stripe-webhook.ts`;
- `redirect()` called inside `try`/`catch`;
- Prisma queries outside `src/lib/queries/` that load donations or donors for display.

## 4. Report

Start with a one-line verdict: **PASS** or **N issue(s) found**.

Then one table, grouped as Pages, Server Actions, Route Handlers:

| Entry point | Who may use it | Access check | Campaign scope | Anon masking | Verdict |
|---|---|---|---|---|---|
| `/dashboard/campaigns/[id]` | CM, admin | ✅ `requireRole("CAMPAIGN_MANAGER","SUPER_ADMIN")` | ✅ | ✅ | OK |

Use ✅ / ❌ / n/a. In a cell that isn't obvious, add a few words or `file:line`.

Then list each issue with:
- severity (**Critical**: data leak or privilege escalation · **Major** · **Minor**);
- `file:line`;
- a concrete attack, e.g. "a CM opens `/dashboard/campaigns/<id of another CM's campaign>` and sees its donors";
- the fix in one sentence.

Only report problems you have verified in the code. If you're unsure, say so and say what you'd check.
End by asking the user which issues to fix; don't fix anything yourself.
