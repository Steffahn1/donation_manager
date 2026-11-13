import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { generateToken, hashToken } from "./tokens";
import type { Role } from "@/generated/prisma/client";

import { SESSION_COOKIE } from "./session-cookie";
const SESSION_DAYS = 30;

/** The narrow user shape that the rest of the app works with (never the password hash). */
export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Creates a DB-backed session and sets the httpOnly cookie. Call from a Server Action. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the current session (server-side and cookie). Call from a Server Action. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Returns the logged-in user, or null. Memoised per request with React `cache`,
 * so many components can call it while the database is only hit once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
  };
});

/**
 * Authorisation guard used by every protected page, Server Action and Route Handler.
 * Redirects to /login if not signed in, and to /dashboard if the role is not allowed.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Route Handler variant: returns null instead of redirecting, so the handler can send 401/403. */
export async function getUserWithRole(...roles: Role[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) return null;
  return user;
}
