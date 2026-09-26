/**
 * Supabase Auth email templates in the Worklane email layout. Values like
 * `{{ .Token }}` are Go template variables filled in by Supabase when it sends.
 * Regenerate the HTML files with `npm run email:auth`, then paste each into
 * Supabase → Authentication → Email Templates.
 */

import {
  BRAND,
  INK,
  LINE,
  MUTED,
  PANEL,
  button,
  fallbackLink,
  layout,
  paragraphs,
} from "./templates";

const LOGO_SRC = "{{ .SiteURL }}/brand/worklane-email-mark.png";
const IGNORE = "If you didn't request this, you can safely ignore this email.";

function codeBlock(code: string, caption: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border:1px solid ${LINE};border-radius:10px;background:${PANEL};border-collapse:separate">
  <tr>
    <td align="center" style="padding:20px 16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">${caption}</p>
      <p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;line-height:38px;font-weight:700;letter-spacing:8px;color:${INK}">${code}</p>
    </td>
  </tr>
</table>`;
}

function emailChangeRows() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border:1px solid ${LINE};border-radius:10px;background:${PANEL};border-collapse:separate">
  <tr>
    <td style="padding:12px 16px;font-size:13px;line-height:20px;color:${MUTED};white-space:nowrap">Current</td>
    <td align="right" style="padding:12px 16px;font-size:14px;line-height:20px;color:${INK};font-weight:500">{{ .Email }}</td>
  </tr>
  <tr>
    <td style="padding:12px 16px;border-top:1px solid ${LINE};font-size:13px;line-height:20px;color:${MUTED};white-space:nowrap">New</td>
    <td align="right" style="padding:12px 16px;border-top:1px solid ${LINE};font-size:14px;line-height:20px;color:${BRAND};font-weight:600">{{ .NewEmail }}</td>
  </tr>
</table>`;
}

export type AuthEmailTemplate = {
  file: string;
  dashboardName: string;
  subject: string;
  html: string;
};

export function supabaseAuthEmailTemplates(): AuthEmailTemplate[] {
  return [
    {
      file: "confirmation.html",
      dashboardName: "Confirm signup",
      subject: "Your Worklane confirmation code",
      html: layout({
        logoSrc: LOGO_SRC,
        preheader: "Enter this code to finish creating your Worklane account.",
        eyebrow: "Confirm your email",
        title: "Welcome to Worklane",
        content: `${paragraphs("Enter this code on the sign-up screen to confirm {{ .Email }} and finish creating your account.")}
${codeBlock("{{ .Token }}", "Confirmation code")}
${paragraphs("The code expires in 1 hour. Prefer a link? Use the button below on the same device you signed up on.")}
${button("{{ .ConfirmationURL }}", "Confirm email")}`,
        footer: `You're receiving this because someone signed up for Worklane with this address. ${IGNORE}`,
      }),
    },
    {
      file: "magic_link.html",
      dashboardName: "Magic link",
      subject: "Your Worklane sign-in code",
      html: layout({
        logoSrc: LOGO_SRC,
        preheader: "Use this code or link to sign in to Worklane.",
        eyebrow: "Sign in",
        title: "Sign in to Worklane",
        content: `${paragraphs("Use this code to sign in, or click the button below.")}
${codeBlock("{{ .Token }}", "Sign-in code")}
${button("{{ .ConfirmationURL }}", "Sign in")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
        footer: `The code and link expire in 1 hour. ${IGNORE}`,
      }),
    },
    {
      file: "recovery.html",
      dashboardName: "Reset password",
      subject: "Your Worklane password reset code",
      html: layout({
        logoSrc: LOGO_SRC,
        preheader: "Enter this code to choose a new Worklane password.",
        eyebrow: "Password reset",
        title: "Reset your password",
        content: `${paragraphs("We received a request to reset the password for {{ .Email }}. Enter this code on the reset screen, then choose a new password.")}
${codeBlock("{{ .Token }}", "Reset code")}`,
        footer: `The code expires in 1 hour. If you didn't ask to reset your password, you can ignore this email and your password won't change.`,
      }),
    },
    {
      file: "email_change.html",
      dashboardName: "Change email address",
      subject: "Confirm your new Worklane email",
      html: layout({
        logoSrc: LOGO_SRC,
        preheader: "Confirm the change to your Worklane sign-in email.",
        eyebrow: "Account",
        title: "Confirm your new email",
        content: `${paragraphs("Confirm this change to start signing in to Worklane with your new address.")}
${emailChangeRows()}
${button("{{ .ConfirmationURL }}", "Confirm new email")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
        footer: `If you didn't request this change, ignore this email and contact your workspace owner.`,
      }),
    },
    {
      file: "invite.html",
      dashboardName: "Invite user",
      subject: "You've been invited to Worklane",
      html: layout({
        logoSrc: LOGO_SRC,
        preheader: "Accept your invitation to Worklane.",
        eyebrow: "Invitation",
        title: "You've been invited to Worklane",
        content: `${paragraphs("You've been invited to create an account on Worklane. Click the button below to accept and set up your account.")}
${button("{{ .ConfirmationURL }}", "Accept invitation")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
        footer: `If you weren't expecting this invitation, you can safely ignore this email.`,
      }),
    },
    {
      file: "reauthentication.html",
      dashboardName: "Reauthentication",
      subject: "Your Worklane verification code",
      html: layout({
        logoSrc: LOGO_SRC,
        preheader: "Enter this code to confirm it's you.",
        eyebrow: "Security",
        title: "Confirm it's you",
        content: `${paragraphs("Enter this code to confirm this action on your Worklane account.")}
${codeBlock("{{ .Token }}", "Verification code")}`,
        footer: `The code expires shortly. ${IGNORE}`,
      }),
    },
  ];
}
