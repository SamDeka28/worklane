-- Stage seeding runs from the organizations trigger only; not a public RPC.
revoke execute on function public.seed_lead_stages(uuid) from public, anon, authenticated;
revoke execute on function public.seed_lead_stages_on_org() from public, anon, authenticated;
