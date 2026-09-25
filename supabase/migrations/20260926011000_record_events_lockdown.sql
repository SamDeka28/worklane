-- Audit helpers are trigger-internal; keep them off the public RPC surface.
alter function public.audit_task_assignees(jsonb) set search_path = public;

revoke execute on function public.audit_user_labels(uuid[]) from public, anon, authenticated;
revoke execute on function public.audit_task_assignees(jsonb) from public, anon, authenticated;
revoke execute on function public.record_entity_event() from public, anon, authenticated;
