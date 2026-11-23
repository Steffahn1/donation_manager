import { describe, expect, it } from "vitest";
import { campaignSchema, submittedCampaignValues } from "./campaign-form";
import { firstIssue } from "./form-errors";
import { MAX_STORY_LENGTH } from "./story";

const valid = {
  name: "Winter Food Parcels",
  description: "Food parcels for families through winter.",
  story: "",
  target: "150000",
  startDate: "2026-06-01",
  endDate: "2026-08-31",
  status: "ACTIVE",
  imagePath: "",
  impactAmount: "500",
  impactLabel: "family fed for a week",
  managerId: "m1",
};

describe("campaignSchema: the article", () => {
  it("refuses an article over the limit (never cuts it short) and points at the story field", () => {
    const parsed = campaignSchema.safeParse({ ...valid, story: "x".repeat(MAX_STORY_LENGTH + 1) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = firstIssue(parsed.error);
      expect(issue.field).toBe("story");
      expect(issue.error).toMatch(/^The article can be at most 20\s000 characters\.$/); // en-ZA uses a no-break space
    }
  });

  it("counts a browser's \\r\\n line break as one character, like the form's counter", () => {
    // 10 000 lines of "x" = 19 999 characters with \n, but 29 998 if \r\n counted twice.
    const story = Array(10_000).fill("x").join("\r\n");
    const parsed = campaignSchema.safeParse({ ...valid, story });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.story).not.toContain("\r");
  });

  it("accepts an empty article", () => {
    const parsed = campaignSchema.safeParse(valid);
    expect(parsed.success && parsed.data.story).toBe("");
  });
});

describe("submittedCampaignValues", () => {
  it("returns every campaign field as text (missing ones empty) and ignores anything else", () => {
    const form = new FormData();
    form.set("name", "Shoes");
    form.set("status", "CLOSED");
    form.set("secret", "not a field");
    const values = submittedCampaignValues(form);
    expect(values).toMatchObject({ name: "Shoes", status: "CLOSED", story: "", managerId: "" });
    expect(values).not.toHaveProperty("secret");
    expect(Object.keys(values)).toEqual(Object.keys(valid));
  });
});
