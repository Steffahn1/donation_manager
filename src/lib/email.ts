import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import type { EmailContent } from "./email-templates";
import { errorSummary } from "./stripe";

let transport: Transporter | null = null;

function transporter(): Transporter {
  transport ??= createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false, // Mailpit in development; a real SMTP server would need TLS and credentials
  });
  return transport;
}

/**
 * Sends one email. Best effort: returns false on failure and logs only a safe summary (never the
 * address or the message, which contain donor details). Callers decide what a failure means.
 */
export async function sendEmail(to: string, content: EmailContent, kind: "verification" | "receipt"): Promise<boolean> {
  try {
    await transporter().sendMail({
      from: process.env.EMAIL_FROM ?? "Donation Manager <no-reply@donations.local>",
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return true;
  } catch (e) {
    console.error(`[email] could not send ${kind} email`, errorSummary(e));
    return false;
  }
}
