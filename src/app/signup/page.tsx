import Link from "next/link";
import { SignupForm } from "@/components/forms/SignupForm";

export const metadata = { title: "Create an account · Donation Manager" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm">
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
