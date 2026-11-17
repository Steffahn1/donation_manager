import { formatZar } from "@/lib/money";

/** Gross raised vs target (gross = before payment-provider fees). The percentage is always written as text too. */
export function ProgressBar({
  raisedCents,
  targetCents,
  label = "Raised towards target",
  showLabel = true,
}: {
  raisedCents: number;
  targetCents: number;
  /** Accessible name, e.g. "Winter Food Parcels: raised towards target". */
  label?: string;
  showLabel?: boolean;
}) {
  const pct = targetCents > 0 ? Math.round((raisedCents / targetCents) * 100) : 0;
  const width = Math.min(pct, 100);
  return (
    <div>
      {showLabel && (
        <p className="mb-2 flex flex-col">
          <span className="stat-number text-[1.75rem]">{formatZar(raisedCents)}</span>
          <span className="heading text-navy">
            raised of {formatZar(targetCents)} · {pct}%
          </span>
        </p>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="progress-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
