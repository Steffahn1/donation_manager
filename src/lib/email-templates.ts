import { formatZar } from "./money";

/**
 * Email contents as pure functions (tested in email-templates.test.ts). They contain only what the
 * recipient needs; links carry random tokens, never names or email addresses.
 */

export type EmailContent = { subject: string; text: string; html: string };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, paragraphs: string[], button: { href: string; label: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("");
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}
<p style="margin:20px 0"><a href="${escapeHtml(button.href)}" style="background:#047857;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>
<p style="font-size:12px;color:#64748b">If the button doesn't work, copy this link into your browser:<br>${escapeHtml(button.href)}</p>
</body></html>`;
}

/**
 * Sent to an address nobody has proven yet, so it contains NO text typed by the person who signed up
 * (otherwise signup could be used to send arbitrary text, such as phishing links, from our address).
 */
export function verificationEmail(input: { verifyUrl: string; validHours: number }): EmailContent {
  const title = "Confirm your email address";
  const intro = "Hi there, someone (hopefully you) asked to create a Donation Manager account with this email address.";
  const ask = `Open the link to confirm it and choose your name and password. Your past donations made with this address will then appear in your account. The link works for ${input.validHours} hours.`;
  const ignore = "If you didn't create an account, you can ignore this email.";
  return {
    subject: title,
    text: `${intro}\n\n${ask}\n\n${input.verifyUrl}\n\n${ignore}\n`,
    html: layout(title, [escapeHtml(intro), escapeHtml(ask), escapeHtml(ignore)], {
      href: input.verifyUrl,
      label: "Confirm and choose a password",
    }),
  };
}

export function receiptEmail(input: {
  name: string;
  amountCents: number;
  campaignName: string;
  paidAt: Date;
  anonymous: boolean;
  receiptUrl: string;
}): EmailContent {
  const date = new Intl.DateTimeFormat("en-ZA", { dateStyle: "long", timeZone: "Africa/Johannesburg" }).format(input.paidAt);
  const amount = formatZar(input.amountCents);
  const title = `Thank you for your donation of ${amount}`;
  const lines = [
    `Hi ${input.name}, thank you for supporting ${input.campaignName}.`,
    `Amount: ${amount} (once-off). Paid on ${date}.`,
    input.anonymous
      ? "You gave anonymously: charity staff see this gift as “Anonymous”."
      : "You gave under your name.",
    "You can check this donation and the campaign's progress at any time with your private link below. Keep it to yourself: anyone with the link can see this receipt.",
  ];
  return {
    subject: title,
    text: `${lines.join("\n\n")}\n\n${input.receiptUrl}\n`,
    html: layout(title, lines.map(escapeHtml), { href: input.receiptUrl, label: "View my receipt" }),
  };
}
