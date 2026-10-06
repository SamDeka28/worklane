-- The send rate check filters by studio, sender, and recent sent_at.
create index if not exists lead_emails_sender_recent_idx
  on public.lead_emails (organization_id, sent_by, sent_at desc);
