import nodemailer from "nodemailer";
import { EMAIL_LOGO_CID, EMAIL_LOGO_PNG_BASE64 } from "./logo";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; skipped?: boolean };

function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit && !explicit.includes("localhost")) return explicit;
  // Prefer stable production host on Vercel so invite emails are not localhost.
  const production =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.replace(/\/$/, "");
  if (production) {
    return production.startsWith("http") ? production : `https://${production}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return explicit || "http://localhost:3000";
}

export function getAppUrl() {
  return appUrl();
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    String(process.env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true";
  const user = process.env.SMTP_USER ?? "";
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const transport = transporter();
  if (!transport) {
    return {
      ok: false,
      skipped: true,
      error: "Email is not configured (set SMTP_USER and SMTP_PASS)",
    };
  }

  const from =
    process.env.EMAIL_FROM?.trim() ||
    `Worklane <${process.env.SMTP_USER}>`;

  try {
    const info = await transport.sendMail({
      from,
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      attachments: input.html.includes(`cid:${EMAIL_LOGO_CID}`)
        ? [
            {
              filename: "worklane.png",
              content: Buffer.from(EMAIL_LOGO_PNG_BASE64, "base64"),
              contentType: "image/png",
              cid: EMAIL_LOGO_CID,
              contentDisposition: "inline",
            },
          ]
        : undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export {
  escapeHtml,
  inviteEmailHtml,
  inviteEmailText,
  invoiceEmailHtml,
  invoiceEmailText,
  notificationEmailHtml,
  notificationEmailText,
  roleLabel,
} from "./templates";
