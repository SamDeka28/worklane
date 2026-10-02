-- Remember whether an assistant connection may change the studio.
-- Older grants stay read-only until the member connects again.

alter table public.oauth_grants
  add column if not exists scope text not null default 'worklane:read offline_access';
