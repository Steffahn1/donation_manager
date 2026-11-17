/** Design system stat card: big slab number with a condensed label that says what it counts. */
export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card space-y-1.5">
      <p className="heading text-navy">{label}</p>
      <p className="stat-number text-[2.25rem]">{value}</p>
      {hint && <p className="text-muted text-sm">{hint}</p>}
    </div>
  );
}
