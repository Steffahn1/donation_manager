"use client";

import { useActionState } from "react";
import { createManager } from "@/app/actions/admin";
import { FORM_ERROR_ID, fieldErrorProps } from "@/lib/form-errors";

export function ManagerForm() {
  const [state, action, pending] = useActionState(createManager, undefined);
  return (
    <form action={action} className="card space-y-4" key={state?.success}>
      <h2 className="section-title">Add a campaign manager</h2>
      {state?.error && <p id={FORM_ERROR_ID} className="error" role="alert">{state.error}</p>}
      <p className="text-muted text-sm">All fields are required.</p>
      {state?.success && <p className="border-success bg-success-bg text-success border-l-4 px-3 py-2 text-sm" role="status">{state.success}</p>}
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" required {...fieldErrorProps(state, "name")} />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required {...fieldErrorProps(state, "email")} />
      </div>
      <div>
        <label className="label" htmlFor="password">Initial password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="text"
          minLength={8}
          required
          autoComplete="new-password"
          {...fieldErrorProps(state, "password")}
        />
      </div>
      <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create manager"}</button>
    </form>
  );
}
