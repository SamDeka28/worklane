"use client";

import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  Copy,
  ExternalLink,
  Globe,
  ListChecks,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { SheetTabs, tabPanelProps } from "@/components/studio/sheet-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  saveLeadIntakeAction,
  updateCrmSettingsAction,
  updateStageProbabilitiesAction,
} from "@/modules/crm/settings-actions";
import type { CrmSettings } from "@/modules/crm/settings";
import { CrmEmailTemplates } from "@/modules/crm/components/crm-email-templates";
import {
  openPipelineStages,
  stageProbabilityBps,
  type CrmMember,
  type LeadStageRecord,
} from "@/modules/crm/types";

type SettingsTab = "pipeline" | "lists" | "email" | "intake";

const noopSubscribe = () => () => {};

function useOrigin() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-2xl bg-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

export function CrmSettingsSheet({
  orgSlug,
  stages,
  settings,
  members,
}: {
  orgSlug: string;
  stages: LeadStageRecord[];
  settings: CrmSettings;
  members: CrmMember[];
}) {
  const router = useRouter();
  const origin = useOrigin();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<SettingsTab>("pipeline");
  const openStages = openPipelineStages(stages).filter((stage) => !stage.id.startsWith("default-"));
  const [percents, setPercents] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      openStages.map((stage) => [
        stage.id,
        String(Math.round(stageProbabilityBps(stage, stages) / 100)),
      ]),
    ),
  );

  const intake = settings.intake;
  const formPath = intake.code ? `/portal/f/${intake.code}` : null;
  const formUrl = formPath ? `${origin}${formPath}` : null;
  const embed = formUrl
    ? `<iframe src="${formUrl}?embed=1" style="width:100%;min-height:640px;border:0" title="Enquiry form"></iframe>`
    : null;

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Couldn’t copy"),
    );
  }

  function saveSettings(formData: FormData, message: string) {
    start(async () => {
      const result = await updateCrmSettingsAction(orgSlug, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  const idPrefix = "crm-settings";

  return (
    <ActionSheet
      title="CRM settings"
      description="How your pipeline scores, flags, and captures leads."
      triggerLabel="Settings"
      triggerVariant="outline"
      triggerSize="sm"
      triggerIcon={<SlidersHorizontal className="size-3.5" />}
      triggerIconOnly
      triggerAriaLabel="CRM settings"
      tabs={
        <SheetTabs
          label="CRM settings sections"
          idPrefix={idPrefix}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "pipeline", label: "Pipeline", icon: TrendingUp },
            { id: "lists", label: "Lists", icon: ListChecks },
            { id: "email", label: "Email templates", icon: Mail, badge: settings.emailTemplates.length },
            { id: "intake", label: "Enquiry form", icon: Globe, badge: intake.enabled ? "On" : null },
          ]}
        />
      }
    >
      <div {...tabPanelProps(idPrefix, "pipeline", tab === "pipeline")} className="grid gap-4">
        <Section
          title="Win probability"
          description="Weights the pipeline forecast. Won counts 100%, Lost 0%."
        >
          {openStages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add a lead first so stages are stored for this studio.
            </p>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                start(async () => {
                  const result = await updateStageProbabilitiesAction(
                    orgSlug,
                    openStages.map((stage) => ({
                      stageId: stage.id,
                      percent: Number(percents[stage.id] ?? 0),
                    })),
                  );
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Probabilities saved");
                  router.refresh();
                });
              }}
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                {openStages.map((stage) => (
                  <li
                    key={stage.id}
                    className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {stage.name}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      inputMode="numeric"
                      aria-label={`${stage.name} probability`}
                      value={percents[stage.id] ?? ""}
                      onChange={(event) =>
                        setPercents((current) => ({
                          ...current,
                          [stage.id]: event.target.value,
                        }))
                      }
                      className="h-8 w-20 text-right tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </li>
                ))}
              </ul>
              <div>
                <Button type="submit" size="sm" disabled={pending}>
                  Save probabilities
                </Button>
              </div>
            </form>
          )}
        </Section>

        <Section
          title="Gone quiet"
          description="Open leads with no calls, emails, or stage moves for this long get a “quiet” badge and show up in follow-ups."
        >
          <form
            className="flex flex-wrap items-center gap-2"
            action={(formData) => saveSettings(formData, "Follow-up rule saved")}
          >
            <Input
              id="crm_stale_days"
              name="stale_days"
              type="number"
              min={0}
              max={365}
              aria-label="Days without activity"
              defaultValue={settings.staleDays}
              className="h-9 w-24 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">days · 0 turns it off</span>
            <span className="flex-1" />
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
          </form>
        </Section>
      </div>

      <form
        {...tabPanelProps(idPrefix, "lists", tab === "lists")}
        className="grid gap-4"
        action={(formData) => saveSettings(formData, "Lists saved")}
      >
        <Section
          title="Lost reasons"
          description="Offered when a lead is moved to Lost. Feeds the loss report. One per line."
        >
          <Textarea
            id="crm_lost_reasons"
            name="lost_reasons"
            aria-label="Lost reasons"
            rows={6}
            defaultValue={settings.lostReasons.join("\n")}
          />
        </Section>
        <Section
          title="Lead sources"
          description="Suggested in “Came from” on each lead. One per line."
        >
          <Textarea
            id="crm_sources"
            name="sources"
            aria-label="Lead sources"
            rows={6}
            defaultValue={settings.sources.join("\n")}
          />
        </Section>
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            Save lists
          </Button>
        </div>
      </form>

      <div {...tabPanelProps(idPrefix, "email", tab === "email")}>
        <Section
          title="Email templates"
          description="Used by Send email on a lead. The composer suggests one based on where the lead is."
        >
          <CrmEmailTemplates orgSlug={orgSlug} templates={settings.emailTemplates} />
        </Section>
      </div>

      <form
        {...tabPanelProps(idPrefix, "intake", tab === "intake")}
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await saveLeadIntakeAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(
              formData.get("regenerate") === "1" ? "New link generated" : "Enquiry form saved",
            );
            router.refresh();
          });
        }}
      >
        <Section
          title="Public link"
          description="A form that drops new enquiries straight into the pipeline, with a follow-up due today."
        >
          <Check name="enabled" label="Accept enquiries" defaultChecked={intake.enabled} />
          {formUrl && embed ? (
            <div className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/5">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs">{formUrl}</code>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Copy link"
                  onClick={() => copy(formUrl, "Link")}
                >
                  <Copy className="size-3.5" />
                </Button>
                <a
                  href={formPath ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open form"
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <button
                type="button"
                className="text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => copy(embed, "Embed code")}
              >
                Copy embed code for your website
              </button>
              {!intake.enabled ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  The form is switched off. The link shows “not found” until you turn it on.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Save once to generate your link.</p>
          )}
        </Section>

        <Section title="What visitors see">
          <Field label="Headline" htmlFor="crm_intake_headline">
            <Input
              id="crm_intake_headline"
              name="headline"
              maxLength={120}
              placeholder="Tell us about your project"
              defaultValue={intake.headline}
            />
          </Field>
          <Field label="Intro" htmlFor="crm_intake_intro">
            <Textarea
              id="crm_intake_intro"
              name="intro"
              rows={3}
              maxLength={600}
              placeholder="A line or two about what happens after someone gets in touch."
              defaultValue={intake.intro}
            />
          </Field>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Check name="ask_company" label="Ask for company" defaultChecked={intake.askCompany} />
            <Check name="ask_phone" label="Ask for phone" defaultChecked={intake.askPhone} />
            <Check name="ask_budget" label="Ask for budget" defaultChecked={intake.askBudget} />
          </div>
        </Section>

        <Section title="Where new enquiries go">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Owner" htmlFor="crm_intake_owner">
              <NativeSelect
                id="crm_intake_owner"
                name="owner_user_id"
                defaultValue={intake.ownerUserId ?? ""}
              >
                <option value="">Unassigned (notify managers)</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Source label" htmlFor="crm_intake_source">
              <Input
                id="crm_intake_source"
                name="source"
                maxLength={60}
                defaultValue={intake.source}
                list="crm_intake_sources"
              />
              <datalist id="crm_intake_sources">
                {settings.sources.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
            </Field>
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Save form
          </Button>
          {intake.code ? (
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              name="regenerate"
              value="1"
              disabled={pending}
              onClick={(event) => {
                if (!window.confirm("Generate a new link? The old link stops working.")) {
                  event.preventDefault();
                }
              }}
            >
              <RefreshCw className="size-3.5" />
              New link
            </Button>
          ) : null}
        </div>
      </form>
    </ActionSheet>
  );
}
