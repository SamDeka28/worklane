/**
 * Transactional email templates. Table-based with inline styles so they render
 * consistently in Gmail, Apple Mail, and Outlook (no external CSS, no flexbox).
 */

import { EMAIL_LOGO_CID } from "./logo";

export const BRAND = "#5B4BDB";
export const INK = "#111827";
const BODY = "#374151";
export const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
export const LINE = "#E5E7EB";
const CANVAS = "#F4F4F6";
export const PANEL = "#F9FAFB";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function paragraphs(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${BODY}">${escapeHtml(block).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px">
  <tr>
    <td align="center" bgcolor="${BRAND}" style="border-radius:8px">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

function detailRows(rows: { label: string; value: string; strong?: boolean }[]) {
  const body = rows
    .map(
      (row, index) => `<tr>
    <td style="padding:12px 16px;${index > 0 ? `border-top:1px solid ${LINE};` : ""}font-size:13px;line-height:20px;color:${MUTED};white-space:nowrap">${escapeHtml(row.label)}</td>
    <td align="right" style="padding:12px 16px;${index > 0 ? `border-top:1px solid ${LINE};` : ""}font-size:14px;line-height:20px;color:${INK};font-weight:${row.strong ? 600 : 500}">${escapeHtml(row.value)}</td>
  </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border:1px solid ${LINE};border-radius:10px;background:${PANEL};border-collapse:separate">${body}</table>`;
}

export function fallbackLink(href: string) {
  return `<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:${FAINT}">If the button doesn't work, copy and paste this link into your browser:<br><a href="${escapeHtml(href)}" style="color:${MUTED};word-break:break-all">${escapeHtml(href)}</a></p>`;
}

export function layout(input: {
  preheader: string;
  eyebrow?: string;
  title: string;
  content: string;
  footer: string;
  /** Defaults to the inline CID attachment sent with app emails. */
  logoSrc?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}">
  <tr>
    <td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT}">
        <tr>
          <td style="padding:0 4px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="28" height="28" style="font-size:0;line-height:0"><img src="${input.logoSrc ?? `cid:${EMAIL_LOGO_CID}`}" width="28" height="28" alt="Worklane" style="display:block;width:28px;height:28px;border:0;border-radius:7px"></td>
                <td style="padding-left:10px;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:${INK}">Worklane</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:14px;padding:40px 36px">
            ${input.eyebrow ? `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND}">${escapeHtml(input.eyebrow)}</p>` : ""}
            <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.01em;color:${INK}">${escapeHtml(input.title)}</h1>
            ${input.content}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-size:12px;line-height:18px;color:${FAINT}">
            ${input.footer}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  lead: "Project lead",
  partner: "Partner",
  client: "Client",
  viewer: "Viewer",
};

export function roleLabel(role: string) {
  return ROLE_LABEL[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatEmailDate(isoDate: string) {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export type InviteEmailInput = {
  orgName: string;
  inviterLabel: string;
  role: string;
  acceptUrl: string;
  projectName?: string | null;
};

export function inviteEmailHtml(input: InviteEmailInput) {
  const role = roleLabel(input.role);
  const rows = [
    { label: "Workspace", value: input.orgName },
    { label: "Role", value: role },
    ...(input.projectName ? [{ label: "Project", value: input.projectName }] : []),
  ];
  const intro = input.projectName
    ? `${input.inviterLabel} has invited you to collaborate on ${input.projectName} in ${input.orgName}.`
    : `${input.inviterLabel} has invited you to join ${input.orgName} on Worklane.`;

  return layout({
    preheader: `${input.inviterLabel} invited you to join ${input.orgName} as ${role}.`,
    eyebrow: "Invitation",
    title: `Join ${input.orgName} on Worklane`,
    content: `${paragraphs(intro)}
${detailRows(rows)}
${button(input.acceptUrl, "Accept invitation")}
${fallbackLink(input.acceptUrl)}`,
    footer: `You're receiving this because ${escapeHtml(input.inviterLabel)} invited this address to ${escapeHtml(input.orgName)}. If you weren't expecting it, you can safely ignore this email.`,
  });
}

export function inviteEmailText(input: InviteEmailInput) {
  const role = roleLabel(input.role);
  return [
    `Join ${input.orgName} on Worklane`,
    "",
    input.projectName
      ? `${input.inviterLabel} has invited you to collaborate on ${input.projectName} in ${input.orgName}.`
      : `${input.inviterLabel} has invited you to join ${input.orgName} on Worklane.`,
    "",
    `Workspace: ${input.orgName}`,
    `Role: ${role}`,
    ...(input.projectName ? [`Project: ${input.projectName}`] : []),
    "",
    `Accept the invitation: ${input.acceptUrl}`,
    "",
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");
}

export type NotificationEmailInput = {
  title: string;
  body: string;
  href?: string | null;
  actionLabel?: string;
  orgName?: string | null;
};

export function notificationEmailHtml(input: NotificationEmailInput) {
  return layout({
    preheader: input.body.split("\n")[0] ?? input.title,
    eyebrow: input.orgName ?? undefined,
    title: input.title,
    content: `${paragraphs(input.body)}${input.href ? button(input.href, input.actionLabel ?? "View in Worklane") : ""}`,
    footer: `You're receiving this because you have notifications enabled${input.orgName ? ` for ${escapeHtml(input.orgName)}` : ""} on Worklane.`,
  });
}

export function notificationEmailText(input: NotificationEmailInput) {
  return [input.title, "", input.body.trim(), ...(input.href ? ["", input.href] : [])].join(
    "\n",
  );
}

export type InvoiceEmailInput = {
  orgName: string;
  clientName?: string | null;
  number: string;
  amountLabel: string;
  issuedOn?: string | null;
  dueOn?: string | null;
  viewUrl?: string | null;
  memo?: string | null;
  paymentInstructions?: string | null;
  reminder?: boolean;
};

export function invoiceEmailHtml(input: InvoiceEmailInput) {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hello,";
  const dueText = input.dueOn ? ` Payment is due by ${formatEmailDate(input.dueOn)}.` : "";
  const intro = input.reminder
    ? `This is a friendly reminder that invoice ${input.number} from ${input.orgName} is still open.${dueText}`
    : `Thank you for your business. Your invoice from ${input.orgName} is attached as a PDF.${dueText}`;
  const rows = [
    { label: "Invoice", value: input.number },
    ...(input.issuedOn ? [{ label: "Issued", value: formatEmailDate(input.issuedOn) }] : []),
    ...(input.dueOn ? [{ label: "Due", value: formatEmailDate(input.dueOn) }] : []),
    { label: "Amount due", value: input.amountLabel, strong: true },
  ];

  return layout({
    preheader: `Invoice ${input.number} for ${input.amountLabel}${input.dueOn ? `, due ${formatEmailDate(input.dueOn)}` : ""}.`,
    eyebrow: input.orgName,
    title: input.reminder ? `Reminder: invoice ${input.number}` : `Invoice ${input.number}`,
    content: `${paragraphs(`${greeting}\n\n${intro}`)}
${input.memo && !input.reminder ? paragraphs(input.memo) : ""}
${detailRows(rows)}
${input.paymentInstructions ? paragraphs(`How to pay\n${input.paymentInstructions}`) : ""}
${input.viewUrl ? `${button(input.viewUrl, "View invoice")}\n${fallbackLink(input.viewUrl)}` : ""}`,
    footer: `Sent on behalf of ${escapeHtml(input.orgName)} via Worklane. If you have questions about this invoice, please contact ${escapeHtml(input.orgName)} directly.`,
  });
}

export function invoiceEmailText(input: InvoiceEmailInput) {
  return [
    input.clientName ? `Hi ${input.clientName},` : "Hello,",
    "",
    input.reminder
      ? `This is a friendly reminder that invoice ${input.number} from ${input.orgName} is still open.`
      : `Thank you for your business. Invoice ${input.number} from ${input.orgName} is attached as a PDF.`,
    ...(input.memo && !input.reminder ? ["", input.memo.trim()] : []),
    "",
    `Invoice: ${input.number}`,
    ...(input.issuedOn ? [`Issued: ${formatEmailDate(input.issuedOn)}`] : []),
    ...(input.dueOn ? [`Due: ${formatEmailDate(input.dueOn)}`] : []),
    `Amount due: ${input.amountLabel}`,
    ...(input.paymentInstructions ? ["", "How to pay:", input.paymentInstructions.trim()] : []),
    ...(input.viewUrl ? ["", `View invoice: ${input.viewUrl}`] : []),
    "",
    `${input.orgName}`,
  ].join("\n");
}

export type DocumentEmailInput = {
  orgName: string;
  senderName?: string | null;
  kindLabel: string;
  title: string;
  message: string;
  viewUrl: string;
  pixelUrl?: string | null;
};

export function documentEmailHtml(input: DocumentEmailInput) {
  const pixel = input.pixelUrl
    ? `<img src="${escapeHtml(input.pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0">`
    : "";
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;border:1px solid ${LINE};border-radius:10px;background:${PANEL};border-collapse:separate">
  <tr>
    <td style="padding:18px 20px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">${escapeHtml(input.kindLabel)}</p>
      <p style="margin:0 0 14px;font-size:17px;line-height:24px;font-weight:600;color:${INK}">${escapeHtml(input.title)}</p>
      ${button(input.viewUrl, `View ${input.kindLabel.toLowerCase()}`)}
    </td>
  </tr>
</table>`;

  return layout({
    preheader: `${input.orgName} shared ${input.title} with you.`,
    eyebrow: input.orgName,
    title: input.title,
    content: `${paragraphs(input.message)}
${card}
${fallbackLink(input.viewUrl)}
${pixel}`,
    footer: `Sent by ${escapeHtml(input.senderName || input.orgName)} at ${escapeHtml(input.orgName)} via Worklane. Reply to this email to reach them directly.`,
  });
}

export function documentEmailText(input: DocumentEmailInput) {
  return [
    input.message.trim(),
    "",
    `${input.kindLabel}: ${input.title}`,
    `View it here: ${input.viewUrl}`,
  ].join("\n");
}

export type DocumentUpdateEmailInput = {
  orgName: string;
  heading: string;
  message: string;
  /** Omit when there's no client link (e.g. a copy sent to someone new); the button is dropped. */
  viewUrl?: string | null;
  buttonLabel: string;
  rows?: { label: string; value: string }[];
};

export function documentUpdateEmailHtml(input: DocumentUpdateEmailInput) {
  return layout({
    preheader: input.message.split("\n")[0]?.slice(0, 140) ?? input.heading,
    eyebrow: input.orgName,
    title: input.heading,
    content: `${paragraphs(input.message)}
${input.rows?.length ? detailRows(input.rows) : ""}
${input.viewUrl ? `${button(input.viewUrl, input.buttonLabel)}
${fallbackLink(input.viewUrl)}` : ""}`,
    footer: `Sent on behalf of ${escapeHtml(input.orgName)} via Worklane. Reply to this email to reach them directly.`,
  });
}

export function documentUpdateEmailText(input: DocumentUpdateEmailInput) {
  return [
    input.heading,
    "",
    input.message.trim(),
    ...(input.rows?.length ? ["", ...input.rows.map((row) => `${row.label}: ${row.value}`)] : []),
    ...(input.viewUrl ? ["", `${input.buttonLabel}: ${input.viewUrl}`] : []),
  ].join("\n");
}
