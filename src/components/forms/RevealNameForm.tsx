"use client";

import { useActionState, useState } from "react";
import { revealDonation } from "@/app/actions/donor";

/** Two steps on purpose: revealing is permanent. */
export function RevealNameForm({ donationId, name }: { donationId: string; name: string }) {
  const [state, action, pending] = useActionState(revealDonation, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="text-xs text-emerald-700 underline" onClick={() => setConfirming(true)}>
        Show my name
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
      <p>
        Charity staff will see this gift as <strong>{name}</strong> instead of &ldquo;Anonymous&rdquo;. This
        can&apos;t be undone.
      </p>
      {state?.error && <p className="text-red-800" role="alert">{state.error}</p>}
      <input type="hidden" name="donationId" value={donationId} />
      <div className="flex gap-2">
        <button className="btn px-2 py-1 text-xs" disabled={pending}>{pending ? "Saving…" : "Yes, show my name"}</button>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
