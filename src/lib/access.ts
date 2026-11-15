import type { Role } from "@/generated/prisma/client";

/**
 * Role checks shared by pages (requireRole) and Route Handlers (getUserWithRole / routeAccess).
 * One rule everywhere: no roles listed means "any logged-in user".
 */
export function hasRole(user: { role: Role } | null, roles: Role[]): boolean {
  if (!user) return false;
  return roles.length === 0 || roles.includes(user.role);
}

/** For Route Handlers: 401 when not logged in, 403 when logged in with the wrong role. */
export function routeAccess(user: { role: Role } | null, roles: Role[]): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!user) return { ok: false, status: 401 };
  return hasRole(user, roles) ? { ok: true } : { ok: false, status: 403 };
}
