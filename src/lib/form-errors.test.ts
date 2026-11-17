import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FORM_ERROR_ID, fieldErrorProps, firstIssue } from "./form-errors";

describe("firstIssue", () => {
  const schema = z.object({ name: z.string().min(2, "Name is too short."), email: z.email("Bad email.") });

  it("returns the first message and the field it belongs to", () => {
    const parsed = schema.safeParse({ name: "A", email: "nope" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstIssue(parsed.error)).toEqual({ error: "Name is too short.", field: "name" });
  });

  it("has no field for a whole-form rule", () => {
    const whole = z.object({ a: z.string() }).refine(() => false, { message: "Whole form is wrong." });
    const parsed = whole.safeParse({ a: "x" });
    if (!parsed.success) expect(firstIssue(parsed.error)).toEqual({ error: "Whole form is wrong.", field: undefined });
  });
});

describe("fieldErrorProps", () => {
  it("marks only the field the error is about, and links it to the error message", () => {
    const state = { error: "Bad email.", field: "email" };
    expect(fieldErrorProps(state, "email")).toEqual({ "aria-invalid": true, "aria-describedby": FORM_ERROR_ID });
    expect(fieldErrorProps(state, "name")).toEqual({});
  });

  it("marks every field for '*' (e.g. incorrect email or password)", () => {
    const state = { error: "Incorrect email or password.", field: "*" };
    expect(fieldErrorProps(state, "password")["aria-invalid"]).toBe(true);
  });

  it("keeps the field's own help text, with or without an error", () => {
    expect(fieldErrorProps(undefined, "amount", "amount-help")).toEqual({ "aria-describedby": "amount-help" });
    expect(fieldErrorProps({ error: "Too small.", field: "amount" }, "amount", "amount-help")).toEqual({
      "aria-invalid": true,
      "aria-describedby": `${FORM_ERROR_ID} amount-help`,
    });
  });

  it("marks nothing when there is no error or the error has no field", () => {
    expect(fieldErrorProps(undefined, "email")).toEqual({});
    expect(fieldErrorProps({ error: "Link expired." }, "email")).toEqual({});
  });
});
