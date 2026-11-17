"use client";

import { useActionState, useState } from "react";
import { revealDonation } from "@/app/actions/donor";

/** Two steps on purpose: revealing is permanent. */
export function RevealNameForm({ donationId, name }: { donationId: string; name: string }) {
  const [state, action, pending] = useActionState(revealDonation, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="link block py-1 text-sm" onClick={() => setConfirming(true)}>
        Show my name
      </button>
    );
  }
  return (
    <form action={action} className="border-coral-text bg-cream space-y-2 border-l-4 p-3 text-sm">
      <p>
        Charity staff will see this gift as <strong>{name}</strong> instead of &ldquo;Anonymous&rdquo;. This
        can&apos;t be undone.
      </p>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <input type="hidden" name="donationId" value={donationId} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-sm" disabled={pending}>{pending ? "Saving…" : "Yes, show my name"}</button>
        <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
