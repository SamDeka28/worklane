-- Per-user appearance theme (null = app default)
alter table public.profiles
  add column if not exists theme text;

comment on column public.profiles.theme is 'Appearance theme id from the in-app gallery, or "system"';
