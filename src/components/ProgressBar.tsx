import { formatZar } from "@/lib/money";

/** Gross raised vs target. Gross = before payment-provider fees. */
export function ProgressBar({
  raisedCents,
  targetCents,
  showLabel = true,
}: {
  raisedCents: number;
  targetCents: number;
  showLabel?: boolean;
}) {
  const pct = targetCents > 0 ? Math.round((raisedCents / targetCents) * 100) : 0;
  return (
    <div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={Math.min(pct, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Raised towards target"
      >
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {showLabel && (
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{formatZar(raisedCents)}</span> raised of{" "}
          {formatZar(targetCents)} · {pct}%
        </p>
      )}
    </div>
  );
}
