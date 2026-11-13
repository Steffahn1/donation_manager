import Link from "next/link";
import { getDonationByCheckoutSession } from "@/lib/queries/donations";
import { formatZar, impactUnits } from "@/lib/money";
import { tryAgain } from "@/app/actions/donate";
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
          <p className="text-slate-700">
            Your donation of <strong>{formatZar(donation.amountCents)}</strong> to {campaign.name} has been received.
          </p>
          {units > 0 && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              That pays for {units} × {campaign.impactLabel}.
            </p>
          )}
          <p className="text-sm text-slate-600">A receipt is on its way to your email.</p>
          <Link href={`/campaigns/${campaign.slug}`} className="btn">See the campaign</Link>
        </Message>
      );
    }
    case "PENDING":
      return (
        <Message title="Almost done…">
          <p className="text-slate-700">
            We&apos;re confirming your donation of <strong>{formatZar(donation.amountCents)}</strong> to {campaign.name}.
          </p>
          <PaymentStatusPoller />
        </Message>
      );
    case "FAILED":
      return (
        <Message title="Your payment didn't go through">
          <p className="error">{donation.failureReason ?? "The payment was declined."} You have not been charged.</p>
          <form action={tryAgain.bind(null, session_id as string)}>
            <button className="btn">Try again</button>
          </form>
        </Message>
      );
    case "EXPIRED":
      return (
        <Message title="This payment page expired">
          <p className="text-slate-700">You have not been charged.</p>
          <Link href={`/donate/${campaign.slug}`} className="btn">Start again</Link>
        </Message>
      );
  }
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
