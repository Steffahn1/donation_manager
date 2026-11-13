import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = { title: "Log in · Donation Manager" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <div className="card">
        <LoginForm />
      </div>
      <p className="mt-4 text-center text-sm text-slate-600">
        New donor? <Link href="/signup" className="text-emerald-700 underline">Create an account</Link>
        <br />
        You can also donate without an account.
      </p>
    </div>
  );
}
