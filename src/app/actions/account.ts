"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { confirmVerification, handleSignup } from "@/lib/verification";
import { firstIssue } from "@/lib/form-errors";

/** `field` is the input the error is about, for aria-invalid. */
export type AccountFormState = { error?: string; field?: string } | undefined;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254)),
});

/**
 * Donor signup: email address only. Every valid submission gets the same redirect, immediately; the
 * lookup, account creation and email happen AFTER the response (after()), so neither the response nor
 * its timing shows whether the address already has an account (staff accounts included).
 */
export async function signup(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = signupSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return firstIssue(parsed.error);
  const { email } = parsed.data;
  after(() => handleSignup(email));
  redirect("/signup/check-email");
}

const confirmSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100, "Name is too long."),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200, "Password is too long."),
});

/**
 * The confirm page: only the owner of the inbox gets here, so this is where the account gets its name
 * and password. Confirming ends any other sessions, links earlier donations, then logs this person in.
 */
export async function confirmEmail(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = confirmSchema.safeParse({ name: formData.get("name"), password: formData.get("password") });
  if (!parsed.success) return firstIssue(parsed.error);

  const result = await confirmVerification(formData.get("token"), parsed.data);
  if (!result.ok) {
    if (result.reason === "expired") return { error: "This link has expired. Sign up again with the same email to get a new one." };
    if (result.reason === "error") return { error: "Something went wrong. Please try again." };
    return { error: "This link is not valid or has already been used." };
  }
  await createSession(result.userId);
  redirect("/dashboard");
}
