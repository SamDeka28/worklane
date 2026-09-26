-- Per-user surface + component style (null = app default)
alter table public.profiles
  add column if not exists surface_style text
    check (surface_style in ('open', 'tinted', 'solid')),
  add column if not exists component_style text
    check (component_style in ('fluid', 'balanced', 'crisp'));

comment on column public.profiles.surface_style is 'Page container: open (cards on canvas), tinted, or solid';
comment on column public.profiles.component_style is 'Corner and control shape: fluid, balanced, or crisp';
