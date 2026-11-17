import type { ZodError } from "zod";

/**
 * Form error helpers (design system: errors are announced in a role="alert" box with id
 * FORM_ERROR_ID, and the field they are about gets aria-invalid). Safe to use in client components.
 */

export const FORM_ERROR_ID = "form-error";

/** The first validation problem: its message for the form, and the field it belongs to (if any). */
export function firstIssue(error: ZodError): { error: string; field?: string } {
  const issue = error.issues[0];
  const key = issue?.path[0];
  return { error: issue?.message ?? "Please check the form.", field: typeof key === "string" ? key : undefined };
}

/**
 * Accessibility props for one input. `field` is the name the server said the error is about, or "*"
 * when it applies to every field (e.g. "Incorrect email or password"). `helpId` is the field's own help text.
 */
export function fieldErrorProps(
  state: { error?: string; field?: string } | undefined,
  name: string,
  helpId?: string,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  const invalid = Boolean(state?.error) && (state?.field === name || state?.field === "*");
  const describedBy = [invalid ? FORM_ERROR_ID : null, helpId ?? null].filter(Boolean).join(" ");
  return {
    ...(invalid ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };
}
