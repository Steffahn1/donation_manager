import { describe, expect, it } from "vitest";
import { ANONYMOUS_LABEL, toStaffDonation, type StaffDonationRow } from "./privacy";

const row = (isAnonymous: boolean): StaffDonationRow => ({
  id: "don_1",
  amountCents: 50000,
  status: "SUCCEEDED",
  isAnonymous,
  failureReason: null,
  createdAt: new Date("2026-11-01T10:00:00Z"),
  paidAt: new Date("2026-11-01T10:01:00Z"),
  donorName: "Typed Name",
  campaign: { id: "camp_1", name: "Winter Food Parcels" },
  donor: { id: "donor_1", email: "secret.person@example.test" },
});

describe("toStaffDonation", () => {
  it("masks an anonymous donor completely: no name or email anywhere in the output", () => {
    const out = toStaffDonation(row(true));
    expect(out.donorName).toBe(ANONYMOUS_LABEL);
    expect(out.donorEmail).toBeNull();
    // Defence in depth: the identity must not appear in ANY field (e.g. a future one added by mistake).
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain("Typed Name");
    expect(serialised).not.toContain("secret.person");
    expect(serialised).not.toContain("donor_1");
  });

  it("shows the name typed for this gift and the email when not anonymous", () => {
    const out = toStaffDonation(row(false));
    expect(out.donorName).toBe("Typed Name");
    expect(out.donorEmail).toBe("secret.person@example.test");
  });

  it("keeps the non-identifying donation data", () => {
    const out = toStaffDonation(row(true));
    expect(out).toMatchObject({ id: "don_1", amountCents: 50000, status: "SUCCEEDED", campaignName: "Winter Food Parcels" });
  });
});
