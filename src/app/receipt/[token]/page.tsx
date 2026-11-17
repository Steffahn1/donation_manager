import Link from "next/link";
import { getReceipt } from "@/lib/queries/receipt";
import { formatZar, impactUnits } from "@/lib/money";
import { donorStatusLabel } from "@/lib/donor-summary";
import { ProgressBar } from "@/components/ProgressBar";

/** Private: reached only through the link in the receipt email. Never indexed; no Referer leaks the token. */
export const metadata = {
  title: "Your receipt · Donation Manager",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

const dateFmt = new Intl.DateTimeFormat("en-ZA", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Johannesburg" });

export default async function ReceiptPage({ params }: PageProps<"/receipt/[token]">) {
  const { token } = await params;
  const r = await getReceipt(token);

  if (!r) {
    return (
      <div className="card mx-auto max-w-lg space-y-4">
        <h1 className="page-title">Receipt not found</h1>
        <p>Please use the link from your receipt email exactly as it was sent.</p>
        <Link href="/campaigns" className="btn">See campaigns</Link>
      </div>
    );
  }

  const units = r.status === "SUCCEEDED" ? impactUnits(r.amountCents, r.campaign.impactAmountCents) : 0;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="card space-y-4">
        <h1 className="page-title">Your donation receipt</h1>
        <dl className="divide-line border-line divide-y border">
          <Row label="Campaign" value={r.campaign.name} />
          <Row label="Amount" value={<span className="font-display text-coral-text text-xl">{formatZar(r.amountCents)}</span>} />
          <Row label="Status" value={donorStatusLabel(r)} />
          <Row label="Date" value={dateFmt.format(r.paidAt ?? r.createdAt)} />
          <Row label="Name given" value={r.donorName} />
          <Row label="Shown to the charity as" value={r.isAnonymous ? "Anonymous" : r.donorName} />
        </dl>
        {units > 0 && (
          <p className="impact-chip">
            Your gift pays for {units} × {r.campaign.impactLabel}. Thank you!
          </p>
        )}
        <p className="text-muted text-sm">
          This page is private to whoever has the link. Want to see all your donations in one place?{" "}
          <Link href="/signup" className="link">Create an account</Link> with the same email.
        </p>
      </div>
      <div className="card space-y-3">
        <h2 className="section-title">Campaign progress</h2>
        <ProgressBar
          raisedCents={r.campaignRaised.raisedCents}
          targetCents={r.campaign.targetCents}
          label={`${r.campaign.name}: raised towards target`}
        />
        <Link href={`/campaigns/${r.campaign.slug}`} className="arrow-link">
          Visit the campaign <span className="arrow" aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
