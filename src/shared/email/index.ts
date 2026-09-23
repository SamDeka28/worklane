import nodemailer from "nodemailer";

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
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export function inviteEmailHtml(input: {
  orgName: string;
  inviterLabel: string;
  role: string;
  acceptUrl: string;
  projectName?: string | null;
}) {
  const projectLine = input.projectName
    ? `<p style="margin:0 0 16px">You'll also join the project <strong>${escapeHtml(input.projectName)}</strong>.</p>`
    : "";
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#71717a">Worklane</p>
    <h1 style="margin:0 0 12px;font-size:22px">Join ${escapeHtml(input.orgName)}</h1>
    <p style="margin:0 0 16px">${escapeHtml(input.inviterLabel)} invited you as <strong>${escapeHtml(input.role)}</strong>.</p>
    ${projectLine}
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:600">Accept invite</a>
    </p>
    <p style="margin:0;font-size:12px;color:#71717a">Or open: ${escapeHtml(input.acceptUrl)}</p>
  </div>
</body></html>`;
}

export function notificationEmailHtml(input: {
  title: string;
  body: string;
  href?: string | null;
}) {
  const link = input.href
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(input.href)}" style="color:#1d4ed8">Open in Worklane</a></p>`
    : "";
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#71717a">Worklane</p>
    <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(input.title)}</h1>
    <p style="margin:0;white-space:pre-wrap">${escapeHtml(input.body)}</p>
    ${link}
  </div>
</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
