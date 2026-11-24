import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "@/components/forms/SignupForm";

export const metadata = { title: "Create an account · Donation Manager" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm">
      {/* Reads the session cookie, so it runs per request behind its own boundary. */}
      <Suspense fallback={null}>
        <SendLoggedInToDashboard />
      </Suspense>
      <h1 className="page-title mb-2">Create a donor account</h1>
      <p className="mb-6 text-muted text-sm">
        See all your donations and the difference they make. You can also donate without an account.
        Start with your email address; you&apos;ll choose your password from the link we send you.
      </p>
      <div className="card">
        <SignupForm />
      </div>
      <p className="mt-4 text-center text-muted text-sm">
        Already have an account? <Link href="/login" className="link">Log in</Link>
      </p>
    </div>
  );
}

/**
 * Someone who is already logged in (e.g. after "Track your giving" on the landing page) has an
 * account, so they go straight to their dashboard instead of the signup form.
 */
async function SendLoggedInToDashboard() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return null;
}
