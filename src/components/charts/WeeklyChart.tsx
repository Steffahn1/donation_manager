"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatZar } from "@/lib/money";

/** Receives only week totals (no donor data). Paid donations, gross, Monday–Sunday Johannesburg weeks. */
export type WeekPoint = { weekStart: string; raisedCents: number; donationCount: number; current: boolean };


/** Axis labels in whole rand (compact); tooltips use the app's exact formatZar. */
const randAxis = (cents: number) => `R ${Math.round(cents / 100).toLocaleString("en-ZA")}`;
const weekLabel = (iso: string) =>
  `w/c ${new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" })}`;

export function WeeklyChart({ data }: { data: WeekPoint[] }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-muted text-sm">
        Raised per week (Monday to Sunday), gross. The darker bar is this week so far.
      </figcaption>
      <div className="h-64 w-full" role="img" aria-label="Chart comparing money raised week by week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6e7e8" vertical={false} />
            <XAxis dataKey="weekStart" tickFormatter={weekLabel} tick={{ fontSize: 12, fill: "#5b6474" }} />
            <YAxis tickFormatter={randAxis} width={80} tick={{ fontSize: 12, fill: "#5b6474" }} />
            <Tooltip
              labelFormatter={(label) => weekLabel(String(label))}
              formatter={(value, _name, item) => [
                `${formatZar(Number(value))} from ${(item?.payload as WeekPoint | undefined)?.donationCount ?? 0} donations`,
                "Raised",
              ]}
            />
            <Bar dataKey="raisedCents" radius={[3, 3, 0, 0]}>
              {data.map((w) => (
                <Cell key={w.weekStart} fill={w.current ? "#274078" : "#e86044"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
