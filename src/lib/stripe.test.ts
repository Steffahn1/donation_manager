import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { classifyCreateError, errorSummary, isCheckoutSessionId, isResourceMissing } from "./stripe";

describe("errorSummary", () => {
  it("never includes the error message, which can echo donor details back", () => {
    const e = new Stripe.errors.StripeInvalidRequestError({
      type: "invalid_request_error",
      message: "Invalid email address: secret.person@example.test",
      code: "email_invalid",
    });
    const summary = errorSummary(e);
    expect(JSON.stringify(summary)).not.toContain("secret.person");
    expect(summary).toMatchObject({ source: "stripe", type: "StripeInvalidRequestError", code: "email_invalid" });
  });

  it("logs only the name and code of other errors", () => {
    const e = Object.assign(new Error("Unique constraint failed for secret.person@example.test"), { code: "P2002" });
    const summary = errorSummary(e);
    expect(JSON.stringify(summary)).not.toContain("secret.person");
    expect(summary).toEqual({ source: "app", name: "Error", code: "P2002" });
  });
});

describe("classifyCreateError", () => {
  it("retries only when the request never reached Stripe", () => {
    expect(classifyCreateError(new Stripe.errors.StripeConnectionError({ message: "x" }))).toBe("retry");
    expect(classifyCreateError(new Error("db down"))).toBe("retry");
  });

  it("retries rate limits and 'same request still running', which Stripe does not store for the key", () => {
    expect(classifyCreateError(new Stripe.errors.StripeRateLimitError({ message: "x" }))).toBe("retry");
    expect(
      classifyCreateError(new Stripe.errors.StripeInvalidRequestError({ message: "x", code: "idempotency_key_in_use" })),
    ).toBe("retry");
  });

  it("starts over when Stripe answered, because it replays that answer for the same idempotency key", () => {
    expect(classifyCreateError(new Stripe.errors.StripeAPIError({ message: "x" }))).toBe("restart");
    expect(classifyCreateError(new Stripe.errors.StripeInvalidRequestError({ message: "x" }))).toBe("restart");
  });
});

describe("isResourceMissing", () => {
  it("recognises Stripe's resource_missing only", () => {
    expect(isResourceMissing(new Stripe.errors.StripeInvalidRequestError({ message: "x", code: "resource_missing" }))).toBe(true);
    expect(isResourceMissing(new Stripe.errors.StripeInvalidRequestError({ message: "x", code: "parameter_invalid" }))).toBe(false);
    expect(isResourceMissing(new Error("resource_missing"))).toBe(false);
  });
});

describe("isCheckoutSessionId", () => {
  it("accepts test-mode Checkout Session ids only", () => {
    expect(isCheckoutSessionId("cs_test_a1B2c3D4e5F6g7H8")).toBe(true);
    expect(isCheckoutSessionId("cs_live_a1B2c3D4e5F6g7H8")).toBe(false);
    expect(isCheckoutSessionId("cs_test_short")).toBe(false);
    expect(isCheckoutSessionId("cs_test_abc'; DROP TABLE--")).toBe(false);
    expect(isCheckoutSessionId({ id: "cs_test_a1B2c3D4e5F6g7H8" })).toBe(false);
    expect(isCheckoutSessionId(undefined)).toBe(false);
  });
});
