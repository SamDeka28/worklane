-- Versions that were emailed to a client become frozen "sent" revisions; further edits
-- happen on a new version so every revision the client saw is kept.

update public.document_versions v
   set status = 'sent',
       snapshot = jsonb_build_object(
         'frozenAt', latest.sent_at,
         'clientName', null,
         'projectName', null,
         'contentDoc', latest.content_doc
       )
  from (
    select distinct on (document_version_id) document_version_id, sent_at, content_doc
      from public.document_sends
     where document_version_id is not null
     order by document_version_id, sent_at desc
  ) latest
 where v.id = latest.document_version_id
   and v.status = 'draft'
   and v.locked_at is null;
