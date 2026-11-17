"use client";

import { useActionState } from "react";
import { signup } from "@/app/actions/account";
import { FORM_ERROR_ID, fieldErrorProps } from "@/lib/form-errors";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p id={FORM_ERROR_ID} className="error" role="alert">{state.error}</p>}
      <div>
        <label className="label" htmlFor="email">Email (required)</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          {...fieldErrorProps(state, "email", "email-help")}
          required
        />
        <p id="email-help" className="help">
          Use the address you donated with. We&apos;ll email you a link to confirm it and choose your password;
          your past donations then appear in your account.
        </p>
      </div>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Sending…" : "Continue"}
      </button>
    </form>
  );
}
