"use client";

import { useActionState } from "react";
import { createManager } from "@/app/actions/admin";

export function ManagerForm() {
  const [state, action, pending] = useActionState(createManager, undefined);
  return (
    <form action={action} className="card space-y-4" key={state?.success}>
      <h2 className="font-semibold">Add a campaign manager</h2>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.success}</p>}
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Initial password</label>
        <input className="input" id="password" name="password" type="text" minLength={8} required autoComplete="new-password" />
      </div>
      <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create manager"}</button>
    </form>
  );
}
