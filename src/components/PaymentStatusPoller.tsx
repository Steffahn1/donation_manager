"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 2000;
const MAX_TRIES = 30; // ~1 minute

/**
 * While a donation is still PENDING (the Stripe webhook hasn't arrived yet),
 * re-render the server page every few seconds. The page only reads the status;
 * it never marks a donation as paid itself.
 */
export function PaymentStatusPoller() {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= MAX_TRIES) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(t);
  }, [tries, router]);

  if (tries >= MAX_TRIES) {
    return (
      <p className="text-sm text-slate-600">
        This is taking longer than usual. You don&apos;t need to pay again: we&apos;ll email your receipt as soon as
        the payment is confirmed. You can refresh this page to check.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      Waiting for confirmation from the payment provider…
    </p>
  );
}
