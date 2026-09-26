import { MailCheck, SearchX } from "lucide-react";
import { FilterChip, FilterChips, StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import { IndexBody, SummaryStat, SummaryStrip } from "@/components/studio/index-layout";
import { PixelGuideButton } from "@/modules/emails/components/pixel-guide";
import { TrackEmailButton, TrackedEmailList } from "@/modules/emails/components/tracked-emails";
import { ComposeEmailButton } from "@/modules/emails/components/compose-email";
import { canSeeStudioEmails, listEmailContacts, listTrackedEmails } from "@/modules/emails/queries";
import { isEmailConfigured } from "@/shared/email";
import { mailPixelUrl } from "@/shared/email/pixel";
import type { TrackedEmailScope, TrackedEmailStatus } from "@/modules/emails/types";
import { requireOrg } from "@/modules/identity/org";
import { JOURNEY } from "@/shared/journey-copy";

export default async function EmailsPage({ params, searchParams }: PageProps<"/[orgSlug]/emails">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const canSeeAll = canSeeStudioEmails(ctx);
  const scope: TrackedEmailScope = canSeeAll && query.scope === "all" ? "all" : "mine";
  const status: TrackedEmailStatus =
    query.status === "opened" ? "opened" : query.status === "waiting" ? "waiting" : "all";

  const [emails, contacts] = await Promise.all([
    listTrackedEmails(orgSlug, scope),
    ctx.canWrite ? listEmailContacts(ctx) : Promise.resolve([]),
  ]);
  const pixelBase = mailPixelUrl("");
  const compose = ctx.canWrite ? (
    <ComposeEmailButton
      orgSlug={orgSlug}
      contacts={contacts}
      configured={isEmailConfigured()}
      replyTo={ctx.user.email}
    />
  ) : null;
  const filtered = emails.filter((email) =>
    status === "opened" ? email.openCount > 0 : status === "waiting" ? email.openCount === 0 : true,
  );
  const now = new Date().getTime();
  const opened = emails.filter((email) => email.openCount > 0).length;
  const openedThisWeek = emails.filter(
    (email) => email.lastOpenedAt && now - new Date(email.lastOpenedAt).getTime() < 7 * 86_400_000,
  ).length;
  const base = `/${orgSlug}/emails`;
  const href = (next: { scope?: TrackedEmailScope; status?: TrackedEmailStatus }) => {
    const params = new URLSearchParams();
    const s = next.scope ?? scope;
    const st = next.status ?? status;
    if (s === "all") params.set("scope", "all");
    if (st !== "all") params.set("status", st);
    const rest = params.toString();
    return rest ? `${base}?${rest}` : base;
  };

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.emails.purpose}
        actions={
          <>
            <PixelGuideButton />
            <TrackEmailButton
              pixelBase={pixelBase}
              orgSlug={orgSlug}
              label={JOURNEY.emails.primaryCta}
              variant={compose ? "outline" : "default"}
            />
            {compose}
          </>
        }
      />
      <FilterChips className="border-b border-border/40">
        <FilterChip href={href({ status: "all" })} active={status === "all"}>
          All
        </FilterChip>
        <FilterChip href={href({ status: "opened" })} active={status === "opened"}>
          Opened
        </FilterChip>
        <FilterChip href={href({ status: "waiting" })} active={status === "waiting"}>
          Not opened
        </FilterChip>
        {canSeeAll ? (
          <>
            <span aria-hidden className="mx-1 h-4 w-px self-center bg-border" />
            <FilterChip href={href({ scope: "mine" })} active={scope === "mine"}>
              Mine
            </FilterChip>
            <FilterChip href={href({ scope: "all" })} active={scope === "all"}>
              Everyone
            </FilterChip>
          </>
        ) : null}
      </FilterChips>
      <IndexBody>
        {emails.length > 0 ? (
          <SummaryStrip>
            <SummaryStat
              label="Tracked"
              value={String(emails.length)}
              hint={scope === "all" ? "Across the studio" : "Emails you tracked"}
              tone="slate"
            />
            <SummaryStat
              label="Open rate"
              value={`${Math.round((opened / emails.length) * 100)}%`}
              hint={`${opened} of ${emails.length} opened`}
              tone="sky"
            />
            <SummaryStat
              label="Opened this week"
              value={String(openedThisWeek)}
              hint="Read in the last 7 days"
              tone={openedThisWeek > 0 ? "emerald" : "slate"}
            />
            <SummaryStat
              label="Not opened"
              value={String(emails.length - opened)}
              hint="Worth a nudge?"
              tone={emails.length - opened > 0 ? "amber" : "slate"}
            />
          </SummaryStrip>
        ) : null}
        {emails.length === 0 ? (
          <EmptyState
            icon={MailCheck}
            fill
            title={JOURNEY.emails.emptyTitle}
            body={JOURNEY.emails.emptyBody}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <TrackEmailButton
                  pixelBase={pixelBase}
                  orgSlug={orgSlug}
                  label={JOURNEY.emails.primaryCta}
                  variant={compose ? "outline" : "default"}
                />
                {compose}
              </div>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            fill
            title={status === "opened" ? "Nothing opened yet" : "Everything’s been opened"}
            body="Try another filter."
          />
        ) : (
          <TrackedEmailList
            orgSlug={orgSlug}
            emails={filtered}
            showCreator={scope === "all"}
            now={now}
          />
        )}
      </IndexBody>
    </WorkSurface>
  );
}
