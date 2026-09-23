"use client";

import { useEffect, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { Paperclip, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HiddenDocFields,
  RichEditor,
  type MentionItem,
} from "@/components/editor/rich-editor";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addTaskCommentAction,
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/modules/delivery/actions";
import { TaskDetailFields } from "@/modules/delivery/components/task-detail-fields";
import type {
  BoardTask,
  TaskAssigneeOption,
  TaskComment,
  TaskKind,
  TaskPriority,
  TaskStatus,
} from "@/modules/delivery/types";
import {
  listTaskFilesAction,
  softDeleteFileAction,
  uploadFileAction,
} from "@/modules/files/actions";
import { FileAttachmentPreview } from "@/modules/files/components/file-viewer";
import type { FileRecord } from "@/modules/files/queries";

export type TaskModalProject = {
  id: string;
  name: string;
  clientName: string;
};

export type TaskModalState =
  | { mode: "edit"; taskId: string }
  | {
      mode: "create";
      columnId?: string | null;
      status?: TaskStatus;
      projectId?: string;
    };

function initialDoc(task: BoardTask | null): JSONContent | null {
  if (!task) return null;
  if (task.descriptionDoc) return task.descriptionDoc as JSONContent;
  if (task.description) {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: task.description }] }],
    };
  }
  return null;
}

export function TaskModal({
  orgSlug,
  open,
  state,
  tasks,
  comments,
  milestones,
  milestonesByProject = {},
  projects = [],
  assignees,
  mentions,
  currentUserId,
  canWrite,
  showProjectPicker = false,
  onClose,
}: {
  orgSlug: string;
  open: boolean;
  state: TaskModalState | null;
  tasks: BoardTask[];
  comments: TaskComment[];
  milestones: { id: string; name: string }[];
  milestonesByProject?: Record<string, { id: string; name: string }[]>;
  projects?: TaskModalProject[];
  assignees: TaskAssigneeOption[];
  mentions: MentionItem[];
  currentUserId: string;
  canWrite: boolean;
  showProjectPicker?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isCreate = state?.mode === "create";
  const task =
    state?.mode === "edit" ? (tasks.find((row) => row.id === state.taskId) ?? null) : null;

  const [projectId, setProjectId] = useState(
    state?.mode === "create"
      ? state.projectId || projects[0]?.id || ""
      : task?.projectId || "",
  );
  const [descriptionDoc, setDescriptionDoc] = useState<JSONContent | null>(initialDoc(task));
  const [descriptionPlain, setDescriptionPlain] = useState(task?.description ?? "");
  const [commentDoc, setCommentDoc] = useState<JSONContent | null>(null);
  const [commentPlain, setCommentPlain] = useState("");
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "task");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueOn, setDueOn] = useState(task?.dueOn ?? "");
  const [milestoneId, setMilestoneId] = useState(task?.milestoneId ?? "");
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>(
    task?.assigneeUserIds ?? (task?.assigneeUserId ? [task.assigneeUserId] : []),
  );
  const [labels, setLabels] = useState<string[]>(task?.labels ?? []);

  useEffect(() => {
    if (!open || !state) return;
    if (state.mode === "edit") {
      const next = tasks.find((row) => row.id === state.taskId) ?? null;
      setProjectId(next?.projectId ?? "");
      setDescriptionDoc(initialDoc(next));
      setDescriptionPlain(next?.description ?? "");
      setKind(next?.kind ?? "task");
      setPriority(next?.priority ?? "medium");
      setDueOn(next?.dueOn ?? "");
      setMilestoneId(next?.milestoneId ?? "");
      setAssigneeUserIds(next?.assigneeUserIds ?? (next?.assigneeUserId ? [next.assigneeUserId] : []));
    } else {
      setProjectId(state.projectId || projects[0]?.id || "");
      setDescriptionDoc(null);
      setDescriptionPlain("");
      setKind("task");
      setPriority("medium");
      setDueOn("");
      setMilestoneId("");
      setAssigneeUserIds([]);
      setLabels([]);
    }
    setCommentDoc(null);
    setCommentPlain("");
  }, [open, state, tasks, projects]);

  useEffect(() => {
    if (!open || !task?.id) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    setLoadingFiles(true);
    void listTaskFilesAction(orgSlug, task.id)
      .then((rows) => {
        if (!cancelled) setFiles(rows);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orgSlug, task?.id]);

  const taskComments = task ? comments.filter((row) => row.taskId === task.id) : [];
  const milestoneOptions =
    showProjectPicker && projectId ? (milestonesByProject[projectId] ?? []) : milestones;
  const title = isCreate ? "New card" : (task?.title ?? "Card");

  if (!state) return null;
  if (state.mode === "edit" && !task) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[min(94vh,58rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-[1.75rem] p-0 text-base sm:max-w-5xl lg:max-w-6xl"
      >
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5 pr-14 sm:px-8">
          <DialogTitle className="font-heading text-xl tracking-tight sm:text-2xl">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-[15px]">
            {isCreate
              ? "Write the card on the left, set schedule and ownership on the right."
              : task?.projectName
                ? `${task.projectName}${task.clientName ? ` · ${task.clientName}` : ""}`
                : "Title, description, attachments, and comments."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
            <form
              id="task-card-form"
              className="space-y-6"
              action={(formData) => {
                start(async () => {
                  if (isCreate) {
                    const targetProject = showProjectPicker
                      ? String(formData.get("project_id") ?? projectId).trim()
                      : projectId || task?.projectId || "";
                    if (!targetProject) {
                      toast.error("Pick a project");
                      return;
                    }
                    if (state.mode === "create" && state.columnId) {
                      formData.set("column_id", state.columnId);
                    }
                    if (state.mode === "create" && state.status) {
                      formData.set("status", state.status);
                    }
                    const result = await createTaskAction(orgSlug, targetProject, formData);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Card created");
                    onClose();
                    router.refresh();
                    return;
                  }
                  if (!task) return;
                  const result = await updateTaskAction(orgSlug, task.id, formData);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Card saved");
                  router.refresh();
                });
              }}
            >
              {showProjectPicker ? (
                <input type="hidden" name="project_id" value={projectId} />
              ) : null}
              <Field label="Title" htmlFor="task-title">
                <Input
                  id="task-title"
                  name="title"
                  required
                  defaultValue={task?.title ?? ""}
                  key={`title-${task?.id ?? "new"}-${open}`}
                  disabled={!canWrite}
                  className="h-12 rounded-2xl text-lg font-semibold tracking-tight"
                  placeholder="Card title"
                />
              </Field>

              <Field label="Description" htmlFor="task-description">
                <HiddenDocFields
                  name="description"
                  doc={descriptionDoc}
                  plain={descriptionPlain}
                />
                <RichEditor
                  key={`desc-${task?.id ?? "new"}-${open}`}
                  value={descriptionDoc}
                  editable={canWrite}
                  orgSlug={orgSlug}
                  entityType="task"
                  entityId={task?.id}
                  mentions={mentions}
                  placeholder="What this card is for… Use @ to reference."
                  minHeightClassName="min-h-52"
                  onChange={(doc, plain) => {
                    setDescriptionDoc(doc);
                    setDescriptionPlain(plain);
                  }}
                />
              </Field>
            </form>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight">Attachments</h3>
                {canWrite && task ? (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <Paperclip className="size-4" />
                    Add file
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file || !task) return;
                        start(async () => {
                          const fd = new FormData();
                          fd.set("file", file);
                          fd.set("entity_type", "task");
                          fd.set("entity_id", task.id);
                          const result = await uploadFileAction(orgSlug, fd);
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Attached");
                          const rows = await listTaskFilesAction(orgSlug, task.id);
                          setFiles(rows);
                          router.refresh();
                        });
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {isCreate ? (
                <p className="rounded-2xl bg-muted/50 px-4 py-3.5 text-sm text-muted-foreground">
                  Save the card first, then attach files here.
                </p>
              ) : loadingFiles ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {files.map((file) => (
                    <FileAttachmentPreview
                      key={file.id}
                      file={file}
                      trailing={
                        canWrite ? (
                          <button
                            type="button"
                            className="rounded-lg bg-card/90 p-1.5 text-muted-foreground shadow-sm ring-1 ring-foreground/8 hover:bg-card hover:text-foreground"
                            aria-label="Remove attachment"
                            onClick={() => {
                              start(async () => {
                                const result = await softDeleteFileAction(orgSlug, file.id);
                                if (result.error) {
                                  toast.error(result.error);
                                  return;
                                }
                                setFiles((prev) => prev.filter((row) => row.id !== file.id));
                                router.refresh();
                              });
                            }}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null
                      }
                    />
                  ))}
                </ul>
              )}
            </section>

            {!isCreate && task ? (
              <section className="space-y-4 border-t border-border/40 pt-6">
                <h3 className="text-[15px] font-semibold tracking-tight">Comments</h3>
                <ul className="space-y-3">
                  {taskComments.length === 0 ? (
                    <li className="text-[15px] text-muted-foreground">No comments yet.</li>
                  ) : (
                    taskComments.map((comment) => (
                      <li key={comment.id} className="rounded-2xl bg-muted/55 px-4 py-3">
                        {comment.bodyDoc ? (
                          <RichEditor
                            value={comment.bodyDoc as JSONContent}
                            editable={false}
                            minHeightClassName="min-h-0"
                          />
                        ) : (
                          <p className="text-[15px] leading-relaxed">{comment.body}</p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {comment.createdBy === currentUserId ? "You" : "Teammate"} ·{" "}
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
                {canWrite ? (
                  <form
                    className="grid gap-2.5"
                    action={(formData) => {
                      start(async () => {
                        const result = await addTaskCommentAction(orgSlug, task.id, formData);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        setCommentDoc(null);
                        setCommentPlain("");
                        router.refresh();
                      });
                    }}
                  >
                    <HiddenDocFields name="body" doc={commentDoc} plain={commentPlain} />
                    <RichEditor
                      key={`comment-${taskComments.length}`}
                      value={commentDoc}
                      orgSlug={orgSlug}
                      entityType="task"
                      entityId={task.id}
                      mentions={mentions}
                      placeholder="Write a comment… Use @ to reference."
                      minHeightClassName="min-h-24"
                      onChange={(doc, plain) => {
                        setCommentDoc(doc);
                        setCommentPlain(plain);
                      }}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={pending || !commentPlain.trim()}
                    >
                      Comment
                    </Button>
                  </form>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-border/40 bg-muted/30 px-5 py-5 lg:border-t-0 lg:border-l">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Details
            </p>

            <TaskDetailFields
              formId="task-card-form"
              canWrite={canWrite}
              showProjectPicker={showProjectPicker}
              projects={projects}
              projectId={projectId}
              projectLocked={!isCreate}
              onProjectChange={(id) => {
                setProjectId(id);
                setMilestoneId("");
              }}
              assignees={assignees}
              assigneeUserIds={assigneeUserIds}
              onAssigneesChange={setAssigneeUserIds}
              kind={kind}
              onKindChange={setKind}
              priority={priority}
              onPriorityChange={setPriority}
              dueOn={dueOn}
              onDueChange={setDueOn}
              milestones={milestoneOptions}
              milestoneId={milestoneId}
              onMilestoneChange={setMilestoneId}
              labels={labels}
              onLabelsChange={setLabels}
            />

            {task?.projectId ? (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                nativeButton={false}
                render={
                  <Link
                    href={`/${orgSlug}/projects/${task.projectId}?tab=work&panel=board`}
                  />
                }
              >
                Open project board
              </Button>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              {canWrite ? (
                <Button type="submit" form="task-card-form" disabled={pending}>
                  {pending ? "Saving…" : isCreate ? "Create card" : "Save card"}
                </Button>
              ) : null}
              {canWrite && task ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() => {
                    if (!window.confirm("Remove this card?")) return;
                    start(async () => {
                      const result = await deleteTaskAction(orgSlug, task.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      onClose();
                      router.refresh();
                    });
                  }}
                >
                  Remove card
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
