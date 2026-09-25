-- Personal contact details on profiles. Readable by active teammates (profiles_read_self_or_org).
alter table public.profiles
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists address text;

alter table public.profiles drop constraint if exists profiles_contact_lengths;
alter table public.profiles
  add constraint profiles_contact_lengths check (
    (job_title is null or char_length(job_title) <= 80)
    and (phone is null or char_length(phone) <= 40)
    and (location is null or char_length(location) <= 120)
    and (address is null or char_length(address) <= 500)
  );
