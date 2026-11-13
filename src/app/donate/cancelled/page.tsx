import Link from "next/link";
import { redirect } from "next/navigation";
import { getDonationByCheckoutSession } from "@/lib/queries/donations";
import { formatZar } from "@/lib/money";
import { tryAgain } from "@/app/actions/donate";

export const metadata = { title: "Payment not completed · Donation Manager" };

/** Stripe sends the donor here when they leave the payment page without paying. */
export default async function DonateCancelledPage({ searchParams }: PageProps<"/donate/cancelled">) {
  const { session_id } = await searchParams;
  const donation = await getDonationByCheckoutSession(session_id);

  if (!donation) {
    return (
      <div className="card mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Payment not completed</h1>
        <p className="text-slate-700">You have not been charged.</p>
        <Link href="/campaigns" className="btn">See campaigns</Link>
      </div>
    );
  }

  // Paid in another tab (or the webhook beat the back button): show the thank-you page instead.
  if (donation.status === "SUCCEEDED") redirect(`/donate/success?session_id=${encodeURIComponent(session_id as string)}`);

  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Payment not completed</h1>
      {donation.status === "FAILED" ? (
        <p className="error">{donation.failureReason ?? "The payment was declined."}</p>
      ) : null}
      <p className="text-slate-700">
        Your donation of {formatZar(donation.amountCents)} to {donation.campaign.name} was not completed. You have not
        been charged.
      </p>
      <div className="flex flex-wrap gap-3">
        <form action={tryAgain.bind(null, session_id as string)}>
          <button className="btn">Try again</button>
        </form>
        <Link href={`/campaigns/${donation.campaign.slug}`} className="btn-secondary">Back to campaign</Link>
      </div>
    </div>
  );
}
