import { describe, expect, it } from "vitest";
import { receiptEmail, verificationEmail } from "./email-templates";

describe("verificationEmail", () => {
  const mail = verificationEmail({
    verifyUrl: "http://localhost:3000/verify-email?token=abc_DEF-123",
    validHours: 24,
  });

  it("contains the confirm link and how long it works, in text and HTML", () => {
    expect(mail.text).toContain("http://localhost:3000/verify-email?token=abc_DEF-123");
    expect(mail.html).toContain('href="http://localhost:3000/verify-email?token=abc_DEF-123"');
    expect(mail.text).toContain("24 hours");
  });

  it("takes no text from the person who signed up (it goes to an address nobody has proven)", () => {
    // Compile-time guard: `npm run typecheck` fails if a name/message parameter is ever added back.
    // @ts-expect-error -- verificationEmail must not accept a name
    verificationEmail({ name: "Claim your refund at evil.example", verifyUrl: "x", validHours: 24 });
    expect(mail.text).toContain("Hi there");
  });

  it("escapes the link in the HTML", () => {
    const html = verificationEmail({ verifyUrl: 'http://x.test/?a=1&b="2"', validHours: 24 }).html;
    expect(html).toContain('href="http://x.test/?a=1&amp;b=&quot;2&quot;"');
    expect(html).not.toContain('b="2"');
  });
});

describe("receiptEmail", () => {
  const base = {
    name: "Test Donor",
    amountCents: 25050,
    campaignName: "Winter Food Parcels",
    paidAt: new Date("2026-11-12T08:00:00Z"),
    anonymous: false,
    receiptUrl: "http://localhost:3000/receipt/tok_123",
  };

  it("shows the amount in rand, the campaign, the Johannesburg date and the private link", () => {
    const mail = receiptEmail(base);
    expect(mail.subject).toContain("R 250,50".replace(" ", " "));
    expect(mail.text).toContain("Winter Food Parcels");
    expect(mail.text).toContain("12 November 2026");
    expect(mail.text).toContain("http://localhost:3000/receipt/tok_123");
    expect(mail.html).toContain('href="http://localhost:3000/receipt/tok_123"');
  });

  it("tells an anonymous donor that staff see 'Anonymous'", () => {
    expect(receiptEmail({ ...base, anonymous: true }).text).toContain("Anonymous");
    expect(receiptEmail(base).text).toContain("under your name");
  });

  it("escapes names and campaign names in the HTML", () => {
    const mail = receiptEmail({ ...base, name: "<script>x</script>", campaignName: 'A & "B"' });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("A &amp; &quot;B&quot;");
  });
});
