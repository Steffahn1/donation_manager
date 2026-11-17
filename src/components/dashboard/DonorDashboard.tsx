import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { getDonorDonations } from "@/lib/queries/donor";
import { donorStatusLabel, summarizeGiving, visibleDonations } from "@/lib/donor-summary";
import { formatZar } from "@/lib/money";
import { ProgressBar } from "@/components/ProgressBar";
import { StatCard } from "./StatCard";
import { ExportForm } from "./ExportForm";
import { RevealNameForm } from "@/components/forms/RevealNameForm";

const dateFmt = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" });

const STATUS_STYLE = {
  SUCCEEDED: "badge-success",
  PENDING: "badge-info",
  FAILED: "badge-danger",
  EXPIRED: "badge-neutral",
} as const;

export async function DonorDashboard({ user }: { user: CurrentUser }) {
  const data = await getDonorDonations(user);

  if (!data) {
    // Defensive: unconfirmed accounts have no password and can't log in, so this shouldn't render.
    return (
      <div className="card mx-auto max-w-lg space-y-4">
        <h1 className="page-title">Confirm your email address</h1>
        <p>Please use the link we emailed you to confirm your address.</p>
      </div>
    );
  }

  const rows = visibleDonations(data.rows);
  const summary = summarizeGiving(rows);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Your donations</h1>
        <p className="text-muted mt-2">Thank you, {user.name}.</p>
      </div>

      {rows.length === 0 ? (
        <div className="card space-y-3">
          <p>You haven&apos;t made any donations with {user.email} yet.</p>
          <Link href="/campaigns" className="btn">Find a campaign</Link>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Your giving">
            <StatCard label="Total given" value={formatZar(summary.totalGivenCents)} hint={`${summary.paidGifts} paid donations`} />
            <StatCard label="Campaigns supported" value={summary.campaigns.length} />
          </section>

          {summary.campaigns.length > 0 && (
            <section className="space-y-3">
              <h2 className="section-title">Your impact</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {summary.campaigns.map((c) => (
                  <div key={c.campaignId} className="card space-y-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/campaigns/${c.slug}`} className="heading tap text-navy text-xl underline-offset-4 hover:underline">{c.name}</Link>
                      <span className="text-muted text-sm">You gave {formatZar(c.givenCents)}</span>
                    </div>
                    {c.impactUnits > 0 && (
                      <p className="impact-chip">
                        That&apos;s {c.impactUnits} × {c.impactLabel}.
                      </p>
                    )}
                    <ProgressBar
                      raisedCents={data.raised(c.campaignId).raisedCents}
                      targetCents={c.targetCents}
                      label={`${c.name}: raised towards target`}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card space-y-3">
            <h2 className="section-title">Download your donations</h2>
            <ExportForm action="/api/export/my-donations.csv" />
          </section>

          <section className="card space-y-0 p-0">
            <h2 className="section-title px-5 pt-4 pb-3">History</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th scope="col">Date</th><th scope="col">Campaign</th><th scope="col" className="text-right">Amount</th><th scope="col">Status</th><th scope="col">Shown to the charity as</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{dateFmt.format(r.paidAt ?? r.createdAt)}</td>
                      <td>{r.campaign.name}</td>
                      <td className="num">{formatZar(r.amountCents)}</td>
                      <td>
                        <span className={`badge ${STATUS_STYLE[r.status]}`}>{donorStatusLabel(r)}</span>
                      </td>
                      <td className="space-y-1">
                        {r.isAnonymous ? (
                          <>
                            <span className="text-muted italic">Anonymous</span>
                            {r.status === "SUCCEEDED" && <RevealNameForm donationId={r.id} name={r.donorName} />}
                          </>
                        ) : (
                          r.donorName
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
