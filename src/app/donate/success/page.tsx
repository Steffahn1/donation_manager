import Link from "next/link";
import { getDonationByCheckoutSession } from "@/lib/queries/donations";
import { formatZar, impactUnits } from "@/lib/money";
import { PaymentStatusPoller } from "@/components/PaymentStatusPoller";

export const metadata = { title: "Thank you · Donation Manager" };

/**
 * Stripe sends the donor here after paying. This page only READS the status:
 * the donation becomes SUCCEEDED solely through the verified webhook.
 */
export default async function DonateSuccessPage({ searchParams }: PageProps<"/donate/success">) {
  const { session_id } = await searchParams;
  const donation = await getDonationByCheckoutSession(session_id);

  if (!donation) {
    return (
      <Message title="We couldn't find that payment">
        <Link href="/campaigns" className="btn">See campaigns</Link>
      </Message>
    );
  }

  const { campaign } = donation;

  switch (donation.status) {
    case "SUCCEEDED": {
      const units = impactUnits(donation.amountCents, campaign.impactAmountCents);
      return (
        <Message title="Thank you for your donation!">
          <p>
            Your donation of <strong className="font-display text-coral-text">{formatZar(donation.amountCents)}</strong> to {campaign.name} has been received.
          </p>
          {units > 0 && (
            <p className="impact-chip">
              That pays for {units} × {campaign.impactLabel}
            </p>
          )}
          <p className="text-muted text-sm">
            A receipt with a private link to this donation is on its way to your email.
          </p>
          <Link href={`/campaigns/${campaign.slug}`} className="btn">See the campaign</Link>
        </Message>
      );
    }
    // Stripe only sends donors here after a COMPLETED payment, so FAILED here means an earlier card
    // was declined and the success webhook for the later card hasn't arrived yet. Never tell this
    // donor they weren't charged: wait for the webhook like PENDING.
    case "PENDING":
    case "FAILED":
      return (
        <Message title="Almost done…">
          <p>
            We&apos;re confirming your donation of <strong className="font-display text-coral-text">{formatZar(donation.amountCents)}</strong> to {campaign.name}.
          </p>
          <PaymentStatusPoller />
        </Message>
      );
    case "EXPIRED":
      return (
        <Message title="This payment page expired">
          <p>You have not been charged.</p>
          <Link href={`/donate/${campaign.slug}`} className="btn">Start again</Link>
        </Message>
      );
  }
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h1 className="page-title">{title}</h1>
      {children}
    </div>
  );
}
