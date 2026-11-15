import Link from "next/link";
import { SignupForm } from "@/components/forms/SignupForm";

export const metadata = { title: "Create an account · Donation Manager" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Create a donor account</h1>
      <p className="mb-6 text-sm text-slate-600">
        See all your donations and the difference they make. You can also donate without an account.
        Start with your email address; you&apos;ll choose your password from the link we send you.
      </p>
      <div className="card">
        <SignupForm />
      </div>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account? <Link href="/login" className="text-emerald-700 underline">Log in</Link>
      </p>
    </div>
  );
}
