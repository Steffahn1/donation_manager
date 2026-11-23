"use client";

import { useActionState, useState } from "react";
import { saveCampaign } from "@/app/actions/admin";
import { FORM_ERROR_ID, fieldErrorProps } from "@/lib/form-errors";
import { MAX_STORY_LENGTH } from "@/lib/story";

export type CampaignFormValues = {
  name: string;
  description: string;
  story: string;
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
  const [storyLength, setStoryLength] = useState<number | null>(null);
  // After a failed save React resets the form. Text fields would pick up the new defaultValues, but a
  // <select> only reads defaultValue when it mounts, so remount the whole form (key) with what was
  // submitted: otherwise Status and Manager would silently jump back to their original values.
  const submitted = state?.values;
  const v: CampaignFormValues = submitted
    ? {
        ...initial,
        ...submitted,
        status: (["DRAFT", "ACTIVE", "CLOSED"] as const).find((s) => s === submitted.status) ?? initial.status,
      }
    : initial;

  return (
    <form key={submitted ? JSON.stringify(submitted) : "initial"} action={action} className="card space-y-4">
      {state?.error && <p id={FORM_ERROR_ID} className="error" role="alert">{state.error}</p>}
      <p className="text-muted text-sm">All fields are required unless marked optional.</p>
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" defaultValue={v.name} required {...fieldErrorProps(state, "name")} />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea className="input min-h-28" id="description" name="description" defaultValue={v.description} required {...fieldErrorProps(state, "description")} />
      </div>
      <div>
        <label className="label" htmlFor="story">Article for the &ldquo;Learn more&rdquo; page (optional)</label>
        <textarea
          className="input min-h-96 font-sans leading-relaxed"
          id="story"
          name="story"
          defaultValue={v.story}
          onChange={(e) => setStoryLength(e.target.value.trim().length)}
          {...fieldErrorProps(state, "story", "story-help story-count")}
        />
        <div id="story-help" className="help space-y-1">
          <p>Shown under the description on the public campaign page. Simple formatting:</p>
          <ul className="list-disc pl-5">
            <li><code>## Heading</code> starts a section (<code>###</code> for a smaller heading)</li>
            <li>A blank line starts a new paragraph</li>
            <li><code>- item</code> makes a bullet point, <code>1. step</code> a numbered list</li>
            <li><code>&gt; text</code> makes a quote</li>
            <li><code>**words**</code> makes words bold</li>
          </ul>
          <p>At most {MAX_STORY_LENGTH.toLocaleString("en-ZA")} characters. Images inside articles are not supported yet.</p>
        </div>
        <StoryCount length={storyLength ?? v.story.trim().length} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="target">Target (R)</label>
          <input className="input" id="target" name="target" inputMode="decimal" defaultValue={v.target} required {...fieldErrorProps(state, "target")} />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={v.status} {...fieldErrorProps(state, "status")}>
            <option value="DRAFT">Draft (hidden from public)</option>
            <option value="ACTIVE">Active (accepting donations)</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="startDate">Start date</label>
          <input className="input" id="startDate" name="startDate" type="date" defaultValue={v.startDate} required {...fieldErrorProps(state, "startDate")} />
        </div>
        <div>
          <label className="label" htmlFor="endDate">End date</label>
          <input className="input" id="endDate" name="endDate" type="date" defaultValue={v.endDate} required {...fieldErrorProps(state, "endDate")} />
        </div>
        <div>
          <label className="label" htmlFor="impactAmount">Impact: every (R)</label>
          <input className="input" id="impactAmount" name="impactAmount" inputMode="decimal" defaultValue={v.impactAmount} required {...fieldErrorProps(state, "impactAmount")} />
        </div>
        <div>
          <label className="label" htmlFor="impactLabel">…pays for 1</label>
          <input className="input" id="impactLabel" name="impactLabel" placeholder="family fed for a week" defaultValue={v.impactLabel} required {...fieldErrorProps(state, "impactLabel")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="imagePath">Image path (optional)</label>
        <input className="input" id="imagePath" name="imagePath" placeholder="/campaigns/my-campaign.jpg" defaultValue={v.imagePath} {...fieldErrorProps(state, "imagePath", "imagePath-help")} />
        <p id="imagePath-help" className="help">Put the image file in <code>public/campaigns/</code>. Uploading is future work.</p>
      </div>
      <div>
        <label className="label" htmlFor="managerId">Campaign manager</label>
        <select className="input" id="managerId" name="managerId" defaultValue={v.managerId} required {...fieldErrorProps(state, "managerId")}>
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

/** Character count under the article box. Not a live region: it would interrupt every keystroke. */
function StoryCount({ length }: { length: number }) {
  const over = length > MAX_STORY_LENGTH;
  return (
    <p id="story-count" className={over ? "help text-danger font-bold" : "help"}>
      {length.toLocaleString("en-ZA")} of {MAX_STORY_LENGTH.toLocaleString("en-ZA")} characters
      {over && ": too long, please shorten the article before saving."}
    </p>
  );
}
