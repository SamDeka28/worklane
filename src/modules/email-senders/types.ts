export const SMTP_MODULES = [
  { id: "crm", label: "Leads" },
  { id: "documents", label: "Documents" },
  { id: "compose", label: "Compose" },
  { id: "finance", label: "Invoices" },
  { id: "delivery", label: "Projects" },
] as const;

export type SmtpModuleId = (typeof SMTP_MODULES)[number]["id"];

export function smtpModuleLabel(id: string) {
  return SMTP_MODULES.find((module) => module.id === id)?.label ?? id;
}

export type SmtpScope = "studio" | "personal";

/** Which account an email goes out through: yours, the studio's, or the workspace default. */
export type SenderVia = "personal" | "studio" | "default";

export type SmtpSecurity = "ssl" | "starttls";

export type SmtpSenderSummary = {
  scope: SmtpScope;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromEmail: string;
  fromName: string | null;
  verifiedAt: string | null;
  updatedAt: string;
};

export type SmtpSenderInput = {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  /** Empty keeps the saved password. */
  password: string;
  fromEmail: string;
  fromName: string;
};

export const SMTP_PRESETS: {
  id: string;
  label: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  hint: string;
}[] = [
  {
    id: "google",
    label: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 465,
    security: "ssl",
    hint: "Use an app password (Google Account → Security → App passwords), not your normal password.",
  },
  {
    id: "microsoft",
    label: "Outlook / Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
    security: "starttls",
    hint: "Your admin may need to turn on SMTP AUTH for the mailbox.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    host: "smtp.zoho.com",
    port: 465,
    security: "ssl",
    hint: "Use an app-specific password if two-factor sign-in is on.",
  },
  {
    id: "sendgrid",
    label: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    security: "starttls",
    hint: "Username is apikey; the password is your SendGrid API key.",
  },
  {
    id: "custom",
    label: "Other",
    host: "",
    port: 587,
    security: "starttls",
    hint: "Get the host, port and login from your email provider.",
  },
];
