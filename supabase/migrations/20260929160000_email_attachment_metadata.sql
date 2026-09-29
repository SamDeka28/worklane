-- Keep attachment names and basic file details with sent email records so the
-- Emails module can show what was included. File contents remain with the mail
-- transport and are not stored in the application database.

alter table public.mail_pixels
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.lead_emails
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.mail_pixels
  drop constraint if exists mail_pixels_attachments_array_check;
alter table public.mail_pixels
  add constraint mail_pixels_attachments_array_check
  check (jsonb_typeof(attachments) = 'array');

alter table public.lead_emails
  drop constraint if exists lead_emails_attachments_array_check;
alter table public.lead_emails
  add constraint lead_emails_attachments_array_check
  check (jsonb_typeof(attachments) = 'array');
