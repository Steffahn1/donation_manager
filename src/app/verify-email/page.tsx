import Link from "next/link";
import { isTokenShaped } from "@/lib/verification-rules";
import { VerifyEmailForm } from "@/components/forms/VerifyEmailForm";

export const metadata = {
  title: "Confirm your email · Donation Manager",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const, // the token is in the URL
};

/**
 * Opening this page changes nothing: email security scanners open links automatically, so only the
 * form (a Server Action) confirms the address. The form also sets the account's name and password,
 * which an account has none of before this (see verification-rules.ts).
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;

  if (!isTokenShaped(token)) {
    return (
      <div className="card mx-auto max-w-lg space-y-4">
        <h1 className="page-title">This link is not valid</h1>
        <p>
          Please use the link from your most recent email, or sign up again with the same email to get a new one.
        </p>
        <Link href="/signup" className="btn">Sign up</Link>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-sm space-y-4">
      <h1 className="page-title">Confirm your email</h1>
      <p>
        Choose your name and password to finish creating your account. Donations you made with this email
        address will then appear in your account.
      </p>
      <VerifyEmailForm token={token} />
    </div>
  );
}
