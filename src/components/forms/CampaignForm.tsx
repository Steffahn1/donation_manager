"use client";

import { useActionState } from "react";
import { saveCampaign } from "@/app/actions/admin";
import { FORM_ERROR_ID, fieldErrorProps } from "@/lib/form-errors";

export type CampaignFormValues = {
  name: string;
  description: string;
  target: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  imagePath: string;
  impactAmount: string;
  impactLabel: string;
  managerId: string;
};

export function CampaignForm({
  campaignId,
  initial,
  managers,
}: {
  campaignId: string | null;
  initial: CampaignFormValues;
  managers: { id: string; name: string; email: string }[];
}) {
  const [state, action, pending] = useActionState(saveCampaign.bind(null, campaignId), undefined);

  return (
    <form action={action} className="card space-y-4">
      {state?.error && <p id={FORM_ERROR_ID} className="error" role="alert">{state.error}</p>}
      <p className="text-muted text-sm">All fields are required unless marked optional.</p>
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" defaultValue={initial.name} required {...fieldErrorProps(state, "name")} />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea className="input min-h-28" id="description" name="description" defaultValue={initial.description} required {...fieldErrorProps(state, "description")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="target">Target (R)</label>
          <input className="input" id="target" name="target" inputMode="decimal" defaultValue={initial.target} required {...fieldErrorProps(state, "target")} />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={initial.status} {...fieldErrorProps(state, "status")}>
            <option value="DRAFT">Draft (hidden from public)</option>
            <option value="ACTIVE">Active (accepting donations)</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="startDate">Start date</label>
          <input className="input" id="startDate" name="startDate" type="date" defaultValue={initial.startDate} required {...fieldErrorProps(state, "startDate")} />
        </div>
        <div>
          <label className="label" htmlFor="endDate">End date</label>
          <input className="input" id="endDate" name="endDate" type="date" defaultValue={initial.endDate} required {...fieldErrorProps(state, "endDate")} />
        </div>
        <div>
          <label className="label" htmlFor="impactAmount">Impact: every (R)</label>
          <input className="input" id="impactAmount" name="impactAmount" inputMode="decimal" defaultValue={initial.impactAmount} required {...fieldErrorProps(state, "impactAmount")} />
        </div>
        <div>
          <label className="label" htmlFor="impactLabel">…pays for 1</label>
          <input className="input" id="impactLabel" name="impactLabel" placeholder="family fed for a week" defaultValue={initial.impactLabel} required {...fieldErrorProps(state, "impactLabel")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="imagePath">Image path (optional)</label>
        <input className="input" id="imagePath" name="imagePath" placeholder="/campaigns/my-campaign.jpg" defaultValue={initial.imagePath} {...fieldErrorProps(state, "imagePath", "imagePath-help")} />
        <p id="imagePath-help" className="help">Put the image file in <code>public/campaigns/</code>. Uploading is future work.</p>
      </div>
      <div>
        <label className="label" htmlFor="managerId">Campaign manager</label>
        <select className="input" id="managerId" name="managerId" defaultValue={initial.managerId} required {...fieldErrorProps(state, "managerId")}>
          <option value="" disabled>Choose a manager…</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
          ))}
        </select>
      </div>
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save campaign"}</button>
    </form>
  );
}
