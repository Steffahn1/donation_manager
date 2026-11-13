import "server-only";
import { cookies } from "next/headers";
import { generateToken, hashToken } from "./tokens";

const BROWSER_COOKIE = "dm_browser";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * A random id for this browser, used only to find "my other open payment pages" (see
 * checkout-flow.ts). It identifies a browser, not a person, and only its hash is stored.
 * Call from a Server Action (it may set the cookie).
 */
export async function getBrowserKeyHash(): Promise<string> {
  const store = await cookies();
  let key = store.get(BROWSER_COOKIE)?.value;
  if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) {
    key = generateToken();
    store.set(BROWSER_COOKIE, key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  }
  return hashToken(key);
}
