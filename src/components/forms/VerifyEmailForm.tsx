"use client";

import { useActionState } from "react";
import { confirmEmail } from "@/app/actions/account";

/** Confirming the email is also where the account gets its name and password. */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmail, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Choose a password</label>
        <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Confirming…" : "Confirm my email"}
      </button>
    </form>
  );
}
