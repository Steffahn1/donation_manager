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
      <p className="text-muted text-sm">
        This is taking longer than usual. You don&apos;t need to pay again. Please refresh this page in a minute
        to check the status.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-muted text-sm" role="status">
      <span className="border-coral inline-block size-4 rounded-full border-2 border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
      Waiting for confirmation from the payment provider…
    </p>
  );
}
