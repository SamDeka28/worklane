import { Button } from "@/components/ui/button";
import { revokeAssistantAction } from "@/modules/mcp/actions";

export function ConnectedAssistants({
  grants,
}: {
  grants: { id: string; clientName: string; createdAt: string; lastUsedAt: string | null }[];
}) {
  return (
    <section className="mt-8 grid scroll-mt-4 items-start gap-4 border-t border-border/50 pt-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Connected assistants</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ChatGPT, Claude, and Cursor can read your studios after you allow them at sign-in.
          Disconnecting one means the next request has to sign in again.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assistants connected.</p>
        ) : (
          grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between gap-4 rounded-2xl bg-muted/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{grant.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(grant.createdAt).toLocaleDateString()}
                  {grant.lastUsedAt
                    ? ` · Last used ${new Date(grant.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <form action={revokeAssistantAction.bind(null, grant.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
