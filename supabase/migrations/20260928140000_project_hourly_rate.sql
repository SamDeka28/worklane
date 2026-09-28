-- Default rate per hour for hourly projects. Work logs prefill it and fall back to it.
alter table public.projects
  add column if not exists hourly_rate_minor bigint
    check (hourly_rate_minor is null or hourly_rate_minor >= 0);
