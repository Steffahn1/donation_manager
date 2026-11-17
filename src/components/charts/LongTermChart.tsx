"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatZar } from "@/lib/money";

/** Receives only dates and amounts (no donor data). Paid donations, gross, Johannesburg days. */
export type LongTermPoint = { date: string; raisedCents: number; cumulativeCents: number };


/** Axis labels in whole rand (compact); tooltips use the app's exact formatZar. */
const randAxis = (cents: number) => `R ${Math.round(cents / 100).toLocaleString("en-ZA")}`;
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });

export function LongTermChart({ data }: { data: LongTermPoint[] }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-muted text-sm">
        Money raised per day (bars) and the running total (line), gross, since the start. A payment
        completed after a campaign&apos;s last day counts towards that day.
      </figcaption>
      <div className="h-72 w-full" role="img" aria-label="Chart of money raised per day and running total">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6e7e8" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} tick={{ fontSize: 12, fill: "#5b6474" }} />
            <YAxis yAxisId="day" tickFormatter={randAxis} width={80} tick={{ fontSize: 12, fill: "#5b6474" }} />
            <YAxis yAxisId="total" orientation="right" tickFormatter={randAxis} width={90} tick={{ fontSize: 12, fill: "#5b6474" }} />
            <Tooltip
              labelFormatter={(label) => shortDate(String(label))}
              formatter={(value, name) => [formatZar(Number(value)), name === "raisedCents" ? "That day" : "Running total"]}
            />
            <Bar yAxisId="day" dataKey="raisedCents" fill="#e86044" radius={[2, 2, 0, 0]} />
            <Line yAxisId="total" dataKey="cumulativeCents" stroke="#274078" strokeWidth={2} dot={false} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
