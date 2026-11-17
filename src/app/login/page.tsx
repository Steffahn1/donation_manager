import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = { title: "Log in · Donation Manager" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="page-title mb-6">Log in</h1>
      <div className="card">
        <LoginForm />
      </div>
      <p className="mt-4 text-center text-muted text-sm">
        New donor? <Link href="/signup" className="link">Create an account</Link>
        <br />
        You can also donate without an account.
      </p>
    </div>
  );
}
