import { describe, expect, it } from "vitest";
import { hasRole, routeAccess } from "./access";

describe("hasRole", () => {
  it("with no roles listed, allows any logged-in user (same as requireRole)", () => {
    expect(hasRole({ role: "DONOR" }, [])).toBe(true);
    expect(hasRole(null, [])).toBe(false);
  });

  it("with roles listed, allows only those roles", () => {
    expect(hasRole({ role: "CAMPAIGN_MANAGER" }, ["SUPER_ADMIN", "CAMPAIGN_MANAGER"])).toBe(true);
    expect(hasRole({ role: "DONOR" }, ["SUPER_ADMIN", "CAMPAIGN_MANAGER"])).toBe(false);
  });
});

describe("routeAccess", () => {
  it("answers 401 when logged out and 403 for the wrong role", () => {
    expect(routeAccess(null, ["DONOR"])).toEqual({ ok: false, status: 401 });
    expect(routeAccess({ role: "DONOR" }, ["SUPER_ADMIN"])).toEqual({ ok: false, status: 403 });
    expect(routeAccess({ role: "SUPER_ADMIN" }, ["SUPER_ADMIN"])).toEqual({ ok: true });
  });
});
