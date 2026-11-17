import Link from "next/link";

export const metadata = { title: "Check your email · Donation Manager" };

/** Shown after every signup, whether or not the email already had an account. */
export default function CheckEmailPage() {
  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h1 className="page-title">Check your email</h1>
      <p>
        If this address can be used for a new account, we&apos;ve sent it a link. Open it to choose your name and
        password. The link works for 24 hours.
      </p>
      <p className="text-muted text-sm">
        Already have an account? <Link href="/login" className="link">Log in</Link>.
      </p>
    </div>
  );
}
