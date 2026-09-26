-- More surface/component options + interface style (glass, neumorphic, clay, brutalist)
alter table public.profiles drop constraint if exists profiles_surface_style_check;
alter table public.profiles drop constraint if exists profiles_component_style_check;

alter table public.profiles
  add constraint profiles_surface_style_check
    check (surface_style in ('tinted', 'gradient', 'solid', 'outline', 'open')),
  add constraint profiles_component_style_check
    check (component_style in ('fluid', 'soft', 'balanced', 'crisp', 'sharp')),
  add column if not exists interface_style text
    check (interface_style in ('clean', 'glass', 'neumorphic', 'clay', 'brutalist'));

comment on column public.profiles.interface_style is 'Interface look: clean, glass, neumorphic, clay, or brutalist';
