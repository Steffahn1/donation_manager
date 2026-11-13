import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A random, URL-safe token (256 bits). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** We store only the hash of tokens, so a database leak does not leak live sessions/links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
