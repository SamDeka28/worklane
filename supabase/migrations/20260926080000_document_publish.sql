-- Revisions can be published to clients' existing links without an email.

alter table public.document_sends
  add column if not exists delivery text not null default 'email'
    check (delivery in ('email', 'link'));

alter table public.document_feedback
  drop constraint if exists document_feedback_kind_check;
alter table public.document_feedback
  add constraint document_feedback_kind_check
    check (kind in ('comment', 'suggestion', 'changes_requested', 'reply', 'signed', 'revision'));
