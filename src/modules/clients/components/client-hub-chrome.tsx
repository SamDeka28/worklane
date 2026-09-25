"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AddContactSheet,
  ClientOverflow,
  EditClientSheet,
} from "@/modules/clients/components/client-forms";
import type { ClientNextStep } from "@/modules/clients/next-step";
import { CreateProjectDialog } from "@/modules/delivery/components/delivery-forms";
import type { AttachableDocument } from "@/modules/delivery/components/project-docs";
import { CreateChargeDialog } from "@/modules/finance/components/finance-forms";

export function ClientHubChrome({
  orgSlug,
  client,
  next,
  canWrite,
  editOpen,
  contactOpen,
  projectOpen,
  chargeOpen,
  seeMoney = true,
  attachableDocuments = [],
  canDelete = false,
}: {
  orgSlug: string;
  client: {
    id: string;
    name: string;
    kind: string;
    notes: string | null;
    notesDoc?: Record<string, unknown> | null;
    currency: string;
  };
  next: ClientNextStep;
  canWrite: boolean;
  editOpen?: boolean;
  contactOpen?: boolean;
  projectOpen?: boolean;
  chargeOpen?: boolean;
  seeMoney?: boolean;
  attachableDocuments?: AttachableDocument[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(Boolean(editOpen));
  const [contact, setContact] = useState(Boolean(contactOpen));
  const [project, setProject] = useState(Boolean(projectOpen));
  const [charge, setCharge] = useState(Boolean(chargeOpen));
  const base = `/${orgSlug}/clients/${client.id}`;
  const clientOption = [{ id: client.id, name: client.name, currency: client.currency }];

  useEffect(() => {
    if (projectOpen) setProject(true);
  }, [projectOpen]);

  useEffect(() => {
    if (chargeOpen) setCharge(true);
  }, [chargeOpen]);

  useEffect(() => {
    if (editOpen) setEdit(true);
  }, [editOpen]);

  useEffect(() => {
    if (contactOpen) setContact(true);
  }, [contactOpen]);

  function clearQuery() {
    router.replace(base);
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        {canWrite ? (
          <>
            {next.href === "add-contact" ? (
              <Button size="lg" onClick={() => setContact(true)}>
                {next.cta}
              </Button>
            ) : next.href === "new-project" ? (
              <Button size="lg" onClick={() => setProject(true)}>
                {next.cta}
              </Button>
            ) : next.href === "collect" ? (
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href={`${base}?collect=1#collect`} />}
              >
                {next.cta}
              </Button>
            ) : next.href === "open-project" && next.projectId ? (
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href={`/${orgSlug}/projects/${next.projectId}`} />}
              >
                {next.cta}
              </Button>
            ) : (
              <Button size="lg" onClick={() => setProject(true)}>
                {next.cta}
              </Button>
            )}
            <ClientOverflow
              orgSlug={orgSlug}
              clientId={client.id}
              onEditProfile={() => setEdit(true)}
              onNewProject={() => setProject(true)}
              onNewCharge={seeMoney ? () => setCharge(true) : undefined}
            />
          </>
        ) : null}
      </div>
      <EditClientSheet
        orgSlug={orgSlug}
        clientId={client.id}
        name={client.name}
        kind={client.kind}
        notes={client.notes}
        notesDoc={client.notesDoc}
        canDelete={canWrite && canDelete}
        open={edit}
        onOpenChange={(nextOpen) => {
          setEdit(nextOpen);
          if (!nextOpen && editOpen) clearQuery();
        }}
      />
      <AddContactSheet
        orgSlug={orgSlug}
        clientId={client.id}
        open={contact}
        onOpenChange={(nextOpen) => {
          setContact(nextOpen);
          if (!nextOpen && contactOpen) clearQuery();
        }}
      />
      <CreateProjectDialog
        orgSlug={orgSlug}
        clients={clientOption}
        defaultClientId={client.id}
        open={project}
        onOpenChange={(nextOpen) => {
          setProject(nextOpen);
          if (!nextOpen && projectOpen) clearQuery();
        }}
        hideTrigger
        returnHref={base}
        attachableDocuments={attachableDocuments}
      />
      {seeMoney ? (
        <CreateChargeDialog
          orgSlug={orgSlug}
          clients={clientOption}
          defaultClientId={client.id}
          open={charge}
          onOpenChange={(nextOpen) => {
            setCharge(nextOpen);
            if (!nextOpen && chargeOpen) clearQuery();
          }}
          hideTrigger
          returnHref={base}
        />
      ) : null}
    </>
  );
}
