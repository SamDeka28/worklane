-- Let senders clean up their own private email preview copies if sending fails.
drop policy if exists org_email_attachments_delete on storage.objects;
create policy org_email_attachments_delete on storage.objects
  for delete using (
    bucket_id = 'org-files'
    and (storage.foldername(name))[2] = 'email-attachments'
    and (storage.foldername(name))[3] = (select auth.uid())::text
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  );
