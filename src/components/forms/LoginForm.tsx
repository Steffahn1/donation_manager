"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { FORM_ERROR_ID, fieldErrorProps } from "@/lib/form-errors";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p id={FORM_ERROR_ID} className="error" role="alert">{state.error}</p>}
      <p className="text-muted text-sm">All fields are required.</p>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required {...fieldErrorProps(state, "email")} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          {...fieldErrorProps(state, "password")}
        />
      </div>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
