-- Notification module: categories, actor/entity context, per-user email prefs, realtime.
alter table public.notifications
  add column if not exists category text not null default 'general',
  add column if not exists actor_id uuid references auth.users (id) on delete set null,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete
  using (user_id = auth.uid());

-- { "<category>": { "email": false } } — absent means the category default.
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
