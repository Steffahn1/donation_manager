"use client";

import { useActionState, useEffect, useState } from "react";
import { reviewDonation, startCheckout, type DonateState } from "@/app/actions/donate";
import type { DonateValues } from "@/lib/donations";
import { formatZar } from "@/lib/money";

const PRESETS = ["100", "250", "500", "1000"];

/** Remembered in this browser tab only, so "Try again" after a cancelled payment refills the form. */
const storageKey = (slug: string) => `donate:${slug}`;

function loadSaved(slug: string): DonateValues | null {
  try {
    const raw = sessionStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as DonateValues) : null;
  } catch {
    return null;
  }
}

function save(slug: string, values: DonateValues) {
  try {
    sessionStorage.setItem(storageKey(slug), JSON.stringify(values));
  } catch {
    // Storage unavailable (private mode etc.): retry just starts with an empty form.
  }
}

type Props = {
  slug: string;
  campaignName: string;
  impactAmountCents: number;
  impactLabel: string;
  /** Prefill for a logged-in donor; email is then fixed to their account. */
  account: { name: string; email: string } | null;
  restoreSaved: boolean;
};

export function DonateForm({ slug, campaignName, impactAmountCents, impactLabel, account, restoreSaved }: Props) {
  // One state machine for both steps: "details" -> (review) -> "confirm" -> (pay) -> Stripe.
  const [state, formAction, pending] = useActionState<DonateState, FormData>(
    (prev, formData) =>
      formData.get("intent") === "pay" ? startCheckout(slug, prev, formData) : reviewDonation(slug, prev, formData),
    { step: "details" },
  );
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<DonateValues>({
    name: account?.name ?? "",
    email: account?.email ?? "",
    amount: "250",
    anonymous: false,
  });

  // After "Try again", refill what the donor typed before (client-only storage, so after hydration).
  useEffect(() => {
    if (!restoreSaved) return;
    const saved = loadSaved(slug);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
    if (saved) setValues((v) => ({ ...saved, email: account?.email ?? saved.email, name: saved.name || v.name }));
  }, [restoreSaved, slug, account?.email]);

  if (state.step === "confirm" && !editing) {
    const review = state;
    const amountCents = review.amountCents;
    const units = impactAmountCents > 0 ? Math.floor(amountCents / impactAmountCents) : 0;
    return (
      <form
        action={formAction}
        onSubmit={() => save(slug, review.values)}
        className="space-y-4"
        aria-labelledby="confirm-heading"
      >
        <h2 id="confirm-heading" className="text-lg font-semibold">Please confirm your payment</h2>
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          <Row label="Campaign" value={campaignName} />
          <Row label="Amount" value={<span className="text-base font-bold">{formatZar(amountCents)}</span>} />
          <Row label="Name" value={review.values.name} />
          <Row label="Email" value={review.values.email} />
          <Row
            label="Shown to the charity as"
            value={review.values.anonymous ? "Anonymous (your name is kept private from staff)" : review.values.name}
          />
        </dl>
        {units > 0 && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            That pays for {units} × {impactLabel}.
          </p>
        )}
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
          <strong>Please check the amount before you continue.</strong> This is a once-off donation and
          accidental donations cannot be refunded.
        </p>

        <input type="hidden" name="name" value={review.values.name} />
        <input type="hidden" name="email" value={review.values.email} />
        <input type="hidden" name="amount" value={review.values.amount} />
        <input type="hidden" name="anonymous" value={String(review.values.anonymous)} />
        <input type="hidden" name="attemptId" value={review.attemptId} />
        <input type="hidden" name="intent" value="pay" />

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => setEditing(true)} disabled={pending}>
            Back
          </button>
          {/* Disabled while the request runs and while the browser leaves for Stripe. */}
          <button className="btn flex-1" disabled={pending}>
            {pending ? "Opening secure payment…" : `Confirm and pay ${formatZar(amountCents)}`}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          You&apos;ll pay on Stripe&apos;s secure page. We never see or store your card details.
        </p>
      </form>
    );
  }

  return (
    <form action={formAction} onSubmit={() => setEditing(false)} className="space-y-4">
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <input type="hidden" name="intent" value="review" />

      <fieldset>
        <legend className="label">Amount (ZAR)</legend>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValues((v) => ({ ...v, amount: p }))}
              aria-pressed={values.amount === p}
              className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
                values.amount === p
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              R{Number(p).toLocaleString("en-ZA")}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="amount">Other amount in rand</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R</span>
          <input
            className="input pl-7"
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            value={values.amount}
            onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
          />
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input
          className="input"
          id="name"
          name="name"
          autoComplete="name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </div>
      <div>
        <label className="label" htmlFor="email">Email (for your receipt)</label>
        <input
          className="input read-only:bg-slate-100"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={account !== null}
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
        {account && <p className="mt-1 text-xs text-slate-500">Donations are saved to your account.</p>}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="anonymous"
          className="mt-1"
          checked={values.anonymous}
          onChange={(e) => setValues((v) => ({ ...v, anonymous: e.target.checked }))}
        />
        <span>
          Give anonymously
          <span className="block text-xs text-slate-500">
            Charity staff will see &ldquo;Anonymous&rdquo; instead of your name and email.
          </span>
        </span>
      </label>

      <button className="btn w-full" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
