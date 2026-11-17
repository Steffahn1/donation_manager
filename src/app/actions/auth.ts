"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { canLogIn } from "@/lib/login";

/** `field` is the input the error is about ("*" = all of them), for aria-invalid. */
export type FormState = { error?: string; field?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password.", field: "*" };

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, role: true, emailVerifiedAt: true },
  });
  // Same message and the same slow check whether the email exists or not; unconfirmed donors never get in.
  const allowed = await canLogIn(user, parsed.data.password);
  if (!allowed || !user) return { error: "Incorrect email or password.", field: "*" };

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
