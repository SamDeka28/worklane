"use server";

import { revalidatePath } from "next/cache";
import { docToPlainText } from "@/components/editor/doc-text";
import type { JSONContent } from "@tiptap/core";
import { assertCanMutateVersion, buildLiveSnapshot } from "@/modules/documents/lock";
import { extractDocumentRefs } from "@/modules/documents/refs";
import { buildBasicDocumentTemplate } from "@/modules/documents/templates";
import type { DocumentKind } from "@/modules/documents/types";
import { requireWritableOrg } from "@/modules/identity/org";

const EMPTY_DOC = buildBasicDocumentTemplate({
  kind: "proposal",
  title: "Proposal",
});

function asKind(value: string): DocumentKind {
  if (value === "sow" || value === "other") return value;
  return "proposal";
}

export async function createDocumentAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const title = String(formData.get("title") ?? "").trim();
  const kind = asKind(String(formData.get("kind") ?? "proposal"));
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  if (!title) return { error: "Title is required" };

  let clientMention: { id: string; label: string; type: "client" } | null = null;
  let projectMention: { id: string; label: string; type: "project" } | null = null;

  if (clientId) {
    const { data: client } = await ctx.supabase
      .from("clients")
      .select("id, name")
      .eq("organization_id", ctx.org.id)
      .eq("id", clientId)
      .maybeSingle();
    if (client) {
      clientMention = { id: client.id as string, label: client.name as string, type: "client" };
    }
  }

  if (projectId) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("id, name, client_id")
      .eq("organization_id", ctx.org.id)
      .eq("id", projectId)
      .maybeSingle();
    if (project) {
      projectMention = {
        id: project.id as string,
        label: project.name as string,
        type: "project",
      };
      if (!clientMention && project.client_id) {
        const { data: client } = await ctx.supabase
          .from("clients")
          .select("id, name")
          .eq("organization_id", ctx.org.id)
          .eq("id", project.client_id)
          .maybeSingle();
        if (client) {
          clientMention = {
            id: client.id as string,
            label: client.name as string,
            type: "client",
          };
        }
      }
    }
  }

  const starter = buildBasicDocumentTemplate({
    kind,
    title,
    client: clientMention,
    project: projectMention,
  });

  const { data: document, error } = await ctx.supabase
    .from("documents")
    .insert({
      organization_id: ctx.org.id,
      title,
      kind,
      status: "draft",
      client_id: clientId ?? clientMention?.id ?? null,
      project_id: projectId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !document) return { error: error?.message ?? "Could not create document" };

  const { error: versionError } = await ctx.supabase.from("document_versions").insert({
    organization_id: ctx.org.id,
    document_id: document.id,
    version_number: 1,
    content_doc: starter,
    status: "draft",
    created_by: ctx.userId,
  });
  if (versionError) return { error: versionError.message };

  await syncDocumentRefs(ctx, document.id as string, starter as Record<string, unknown>);

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "document",
    entity_id: document.id,
    metadata: { kind, title },
  });

  revalidatePath(`/${orgSlug}/documents`);
  return { id: document.id as string };
}

export async function saveDocumentVersionAction(
  orgSlug: string,
  versionId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const title = String(formData.get("title") ?? "").trim();
  const contentRaw = String(formData.get("content_doc") ?? "");
  let contentDoc: Record<string, unknown>;
  try {
    contentDoc = JSON.parse(contentRaw) as Record<string, unknown>;
  } catch {
    return { error: "Invalid document content" };
  }

  const { data: version } = await ctx.supabase
    .from("document_versions")
    .select("id, document_id, status, locked_at")
    .eq("id", versionId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!version) return { error: "Version not found" };

  try {
    assertCanMutateVersion({ status: version.status, lockedAt: version.locked_at });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Locked" };
  }

  const { error } = await ctx.supabase
    .from("document_versions")
    .update({ content_doc: contentDoc })
    .eq("id", versionId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  if (title) {
    await ctx.supabase
      .from("documents")
      .update({ title })
      .eq("id", version.document_id)
      .eq("organization_id", ctx.org.id);
  }

  try {
    await syncDocumentRefs(ctx, version.document_id as string, contentDoc);
  } catch (syncError) {
    return {
      error: syncError instanceof Error ? syncError.message : "Could not sync tags",
    };
  }

  revalidatePath(`/${orgSlug}/documents/${version.document_id}`);
  return { ok: true as const };
}

async function syncDocumentRefs(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  documentId: string,
  contentDoc: Record<string, unknown>,
) {
  const refs = extractDocumentRefs(contentDoc as JSONContent);
  await ctx.supabase
    .from("document_refs")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId);

  if (refs.length === 0) return;

  const { error } = await ctx.supabase.from("document_refs").insert(
    refs.map((ref) => ({
      organization_id: ctx.org.id,
      document_id: documentId,
      entity_type: ref.entityType,
      entity_id: ref.entityId,
    })),
  );
  if (error && !/document_refs|does not exist|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function updateDocumentLinksAction(
  orgSlug: string,
  documentId: string,
  input: { clientId?: string | null; projectId?: string | null },
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, client_id, project_id, status")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };
  if (document.status === "accepted" || document.status === "signed") {
    return { error: "Locked documents cannot change links" };
  }

  let clientId =
    input.clientId === undefined ? document.client_id : input.clientId || null;
  let projectId =
    input.projectId === undefined ? document.project_id : input.projectId || null;

  if (projectId) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("id, client_id")
      .eq("id", projectId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!project) return { error: "Project not found" };
    clientId = project.client_id;
  } else if (clientId) {
    const { data: client } = await ctx.supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!client) return { error: "Client not found" };
  }

  const { error } = await ctx.supabase
    .from("documents")
    .update({ client_id: clientId, project_id: projectId })
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  if (projectId) revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true as const, clientId, projectId };
}

export async function createTaggedClientAction(orgSlug: string, documentId: string, name: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data: client, error } = await ctx.supabase
    .from("clients")
    .insert({
      organization_id: ctx.org.id,
      kind: "company",
      name: trimmed,
      currency: ctx.org.defaultCurrency,
      created_by: ctx.userId,
    })
    .select("id, name")
    .single();
  if (error || !client) return { error: error?.message ?? "Could not create client" };

  await ctx.supabase
    .from("documents")
    .update({ client_id: client.id })
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .is("client_id", null);

  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  revalidatePath(`/${orgSlug}/clients`);
  return { id: client.id as string, label: client.name as string, type: "client" as const };
}

export async function createTaggedProjectAction(
  orgSlug: string,
  documentId: string,
  name: string,
  options?: { clientId?: string | null; newClientName?: string | null },
) {
  const ctx = await requireWritableOrg(orgSlug);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, client_id")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };

  let clientId = options?.clientId?.trim() || document.client_id || null;
  if (!clientId && options?.newClientName?.trim()) {
    const { data: client, error: clientError } = await ctx.supabase
      .from("clients")
      .insert({
        organization_id: ctx.org.id,
        kind: "company",
        name: options.newClientName.trim(),
        currency: ctx.org.defaultCurrency,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (clientError || !client) {
      return { error: clientError?.message ?? "Could not create client" };
    }
    clientId = client.id as string;
  }
  if (!clientId) {
    return { error: "Choose or create a client for this project" };
  }

  const { data: project, error } = await ctx.supabase
    .from("projects")
    .insert({
      organization_id: ctx.org.id,
      client_id: clientId,
      name: trimmed,
      status: "planning",
      billing_mode: "milestones",
      default_fee_bps: 500,
      earn_on: "charge",
      created_by: ctx.userId,
    })
    .select("id, name")
    .single();
  if (error || !project) return { error: error?.message ?? "Could not create project" };

  await ensureDefaultColumns(ctx, project.id as string);

  await ctx.supabase
    .from("documents")
    .update({ project_id: project.id, client_id: clientId })
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id);

  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  revalidatePath(`/${orgSlug}/projects`);
  revalidatePath(`/${orgSlug}/clients`);
  return {
    id: project.id as string,
    label: project.name as string,
    type: "project" as const,
    clientId,
  };
}

async function ensureDefaultColumns(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  projectId: string,
) {
  const { data: existing } = await ctx.supabase
    .from("project_columns")
    .select("id")
    .eq("project_id", projectId)
    .eq("organization_id", ctx.org.id)
    .limit(1);
  if (existing && existing.length > 0) return;

  const defaults = [
    { name: "To do", system_key: "todo", position: 0 },
    { name: "Doing", system_key: "doing", position: 1 },
    { name: "Done", system_key: "done", position: 2 },
  ];
  await ctx.supabase.from("project_columns").insert(
    defaults.map((column) => ({
      organization_id: ctx.org.id,
      project_id: projectId,
      ...column,
    })),
  );
}

export async function createTaggedMilestoneAction(
  orgSlug: string,
  documentId: string,
  name: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, project_id")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document?.project_id) {
    return { error: "Link a project before adding milestones" };
  }

  const { data: milestone, error } = await ctx.supabase
    .from("milestones")
    .insert({
      organization_id: ctx.org.id,
      project_id: document.project_id,
      name: trimmed,
      status: "planned",
    })
    .select("id, name")
    .single();
  if (error || !milestone) {
    const legacy = await ctx.supabase
      .from("milestones")
      .insert({
        organization_id: ctx.org.id,
        project_id: document.project_id,
        name: trimmed,
        status: "planned",
      })
      .select("id, name")
      .single();
    if (legacy.error || !legacy.data) {
      return { error: error?.message ?? legacy.error?.message ?? "Could not create milestone" };
    }
    revalidatePath(`/${orgSlug}/documents/${documentId}`);
    revalidatePath(`/${orgSlug}/projects/${document.project_id}`);
    return {
      id: legacy.data.id as string,
      label: legacy.data.name as string,
      type: "milestone" as const,
    };
  }

  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  revalidatePath(`/${orgSlug}/projects/${document.project_id}`);
  return {
    id: milestone.id as string,
    label: milestone.name as string,
    type: "milestone" as const,
  };
}

export async function createTaggedTaskAction(
  orgSlug: string,
  documentId: string,
  name: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, project_id")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document?.project_id) {
    return { error: "Link a project before adding tasks" };
  }

  await ensureDefaultColumns(ctx, document.project_id);

  const { data: columns } = await ctx.supabase
    .from("project_columns")
    .select("id, system_key, position")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", document.project_id)
    .order("position");
  const column =
    columns?.find((row) => row.system_key === "todo") ?? columns?.[0] ?? null;
  if (!column) return { error: "Add a board column first" };

  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("position")
    .eq("organization_id", ctx.org.id)
    .eq("column_id", column.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      organization_id: ctx.org.id,
      project_id: document.project_id,
      column_id: column.id,
      title: trimmed,
      status: "todo",
      priority: "medium",
      position: (last?.position ?? -1) + 1,
    })
    .select("id, title")
    .single();
  if (error || !task) return { error: error?.message ?? "Could not create task" };

  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  revalidatePath(`/${orgSlug}/projects/${document.project_id}`);
  return { id: task.id as string, label: task.title as string, type: "task" as const };
}

export async function freezeDocumentVersionAction(
  orgSlug: string,
  versionId: string,
  nextStatus: "accepted" | "signed",
  formData?: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: version } = await ctx.supabase
    .from("document_versions")
    .select("id, document_id, status, locked_at, content_doc")
    .eq("id", versionId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!version) return { error: "Version not found" };

  try {
    assertCanMutateVersion({ status: version.status, lockedAt: version.locked_at });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Locked" };
  }

  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, title, client_id, project_id")
    .eq("id", version.document_id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };

  let clientName: string | null = null;
  let projectName: string | null = null;
  if (document.client_id) {
    const { data: client } = await ctx.supabase
      .from("clients")
      .select("name")
      .eq("id", document.client_id)
      .maybeSingle();
    clientName = client?.name ?? null;
  }
  if (document.project_id) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("name")
      .eq("id", document.project_id)
      .maybeSingle();
    projectName = project?.name ?? null;
  }

  const frozenAt = new Date().toISOString();
  const snapshot = buildLiveSnapshot({
    clientName,
    projectName,
    contentDoc: (version.content_doc as Record<string, unknown>) ?? {},
    frozenAt,
  });

  if (nextStatus === "signed" && formData) {
    const signerName = String(formData.get("signer_name") ?? "").trim();
    const signerEmail = String(formData.get("signer_email") ?? "").trim();
    const intentText =
      String(formData.get("intent_text") ?? "").trim() ||
      "I agree to the terms in this document.";
    if (!signerName || !signerEmail) {
      return { error: "Name and email are required to sign" };
    }
    const { error: sigError } = await ctx.supabase.from("document_signatures").insert({
      organization_id: ctx.org.id,
      document_version_id: versionId,
      signer_name: signerName,
      signer_email: signerEmail,
      intent_text: intentText,
      user_agent: String(formData.get("user_agent") ?? "").slice(0, 500) || null,
    });
    if (sigError) return { error: sigError.message };
  }

  // Store a plain-text PDF stand-in as a file row content via storage text blob
  const plain = docToPlainText(version.content_doc as JSONContent);
  const pdfBody = `Worklane ${nextStatus.toUpperCase()}\n${document.title}\n\nClient: ${clientName ?? "—"}\nProject: ${projectName ?? "—"}\nFrozen: ${frozenAt}\n\n${plain}\n`;
  const storagePath = `${ctx.org.id}/document_version/${versionId}/${crypto.randomUUID()}.txt`;
  const { error: uploadError } = await ctx.supabase.storage
    .from("org-files")
    .upload(storagePath, new TextEncoder().encode(pdfBody), {
      contentType: "text/plain",
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message };

  const { data: fileRow, error: fileError } = await ctx.supabase
    .from("files")
    .insert({
      organization_id: ctx.org.id,
      entity_type: "document_version",
      entity_id: versionId,
      storage_path: storagePath,
      name: `${document.title}-${nextStatus}.txt`,
      mime: "text/plain",
      size_bytes: pdfBody.length,
      visibility: "internal",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (fileError || !fileRow) return { error: fileError?.message ?? "Could not store signed copy" };

  const { error } = await ctx.supabase
    .from("document_versions")
    .update({
      status: nextStatus,
      snapshot,
      locked_at: frozenAt,
      pdf_file_id: fileRow.id,
    })
    .eq("id", versionId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  await ctx.supabase
    .from("documents")
    .update({ status: nextStatus })
    .eq("id", document.id)
    .eq("organization_id", ctx.org.id);

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: nextStatus === "signed" ? "signed" : "accepted",
    entity_type: "document",
    entity_id: document.id,
    metadata: { version_id: versionId, file_id: fileRow.id },
  });

  revalidatePath(`/${orgSlug}/documents/${document.id}`);
  return { ok: true as const };
}

export async function cloneDocumentVersionAction(orgSlug: string, versionId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: version } = await ctx.supabase
    .from("document_versions")
    .select("id, document_id, content_doc, version_number")
    .eq("id", versionId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!version) return { error: "Version not found" };

  const { data: latest } = await ctx.supabase
    .from("document_versions")
    .select("version_number")
    .eq("document_id", version.document_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = (latest?.version_number ?? version.version_number) + 1;
  const { data: created, error } = await ctx.supabase
    .from("document_versions")
    .insert({
      organization_id: ctx.org.id,
      document_id: version.document_id,
      version_number: nextNumber,
      content_doc: version.content_doc,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Could not clone" };

  await ctx.supabase
    .from("documents")
    .update({ status: "draft" })
    .eq("id", version.document_id);

  revalidatePath(`/${orgSlug}/documents/${version.document_id}`);
  return { id: created.id as string };
}

export async function createSowFromProposalAction(orgSlug: string, documentId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: source } = await ctx.supabase
    .from("documents")
    .select("id, title, client_id, project_id, kind")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!source) return { error: "Document not found" };
  if (source.kind !== "proposal") return { error: "SOW can only be created from a proposal" };

  const { data: version } = await ctx.supabase
    .from("document_versions")
    .select("content_doc")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: sow, error } = await ctx.supabase
    .from("documents")
    .insert({
      organization_id: ctx.org.id,
      title: `SOW · ${source.title}`,
      kind: "sow",
      status: "draft",
      client_id: source.client_id,
      project_id: source.project_id,
      source_document_id: source.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !sow) return { error: error?.message ?? "Could not create SOW" };

  await ctx.supabase.from("document_versions").insert({
    organization_id: ctx.org.id,
    document_id: sow.id,
    version_number: 1,
    content_doc: version?.content_doc ?? EMPTY_DOC,
    status: "draft",
    created_by: ctx.userId,
  });

  revalidatePath(`/${orgSlug}/documents`);
  return { id: sow.id as string };
}

export async function markDocumentSentAction(orgSlug: string, documentId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("documents")
    .update({ status: "sent" })
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  return { ok: true as const };
}

export async function linkDocumentsToProjectAction(
  orgSlug: string,
  projectId: string,
  documentIds: string[],
) {
  const ctx = await requireWritableOrg(orgSlug);
  const ids = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { error: "Pick at least one document" };

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!project) return { error: "Project not found" };

  const { data: docs, error: docsError } = await ctx.supabase
    .from("documents")
    .select("id, client_id, project_id")
    .eq("organization_id", ctx.org.id)
    .in("id", ids);
  if (docsError) return { error: docsError.message };
  if (!docs || docs.length !== ids.length) return { error: "One or more documents were not found" };

  for (const doc of docs) {
    if (doc.project_id && doc.project_id !== projectId) {
      return { error: "A document is already linked to another project" };
    }
    if (doc.client_id && doc.client_id !== project.client_id) {
      return { error: "Document belongs to a different client" };
    }
  }

  const { error } = await ctx.supabase
    .from("documents")
    .update({
      project_id: projectId,
      client_id: project.client_id,
    })
    .eq("organization_id", ctx.org.id)
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/documents`);
  revalidatePath(`/${orgSlug}/clients/${project.client_id}`);
  return { ok: true as const };
}

export async function createProjectFromDocumentAction(orgSlug: string, documentId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, title, client_id, project_id, status")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };
  if (document.project_id) return { error: "This document already links to a project" };
  if (!document.client_id) return { error: "Attach a client before creating a project" };
  if (document.status !== "accepted" && document.status !== "signed") {
    return { error: "Accept or sign the document before creating a project" };
  }

  const { data: version } = await ctx.supabase
    .from("document_versions")
    .select("snapshot")
    .eq("document_id", documentId)
    .not("locked_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshot = (version?.snapshot as { projectName?: string | null } | null) ?? null;
  const name = snapshot?.projectName || document.title;

  const { data: project, error } = await ctx.supabase
    .from("projects")
    .insert({
      organization_id: ctx.org.id,
      client_id: document.client_id,
      name,
      status: "planning",
      billing_mode: "milestones",
      default_fee_bps: 500,
      earn_on: "charge",
      scope: "Created from signed/accepted document snapshot",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !project) return { error: error?.message ?? "Could not create project" };

  await ctx.supabase.from("project_members").upsert(
    {
      organization_id: ctx.org.id,
      project_id: project.id,
      user_id: ctx.userId,
      role: "lead",
    },
    { onConflict: "project_id,user_id" },
  );

  await ctx.supabase
    .from("documents")
    .update({ project_id: project.id })
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id);

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "project",
    entity_id: project.id,
    metadata: { from_document_id: documentId },
  });

  revalidatePath(`/${orgSlug}/documents/${documentId}`);
  revalidatePath(`/${orgSlug}/projects`);
  return { id: project.id as string };
}
