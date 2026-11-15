import Link from "next/link";

export const metadata = { title: "Check your email · Donation Manager" };

/** Shown after every signup, whether or not the email already had an account. */
export default function CheckEmailPage() {
  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Check your email</h1>
      <p className="text-slate-700">
        If this address can be used for a new account, we&apos;ve sent it a link. Open it to choose your name and
        password. The link works for 24 hours.
      </p>
      <p className="text-sm text-slate-600">
        Already have an account? <Link href="/login" className="text-emerald-700 underline">Log in</Link>.
      </p>
    </div>
  );
}
