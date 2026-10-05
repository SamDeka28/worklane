import { describe, expect, it } from "vitest";
import { documentWarnings } from "@/modules/documents/structured";
import { applyDocumentData, readTable } from "@/modules/documents/template-fill";
import { getDocumentTemplate } from "@/modules/documents/templates";

const rentique = {
  deliverables: [
    {
      id: "D1",
      title: "Discovery & UX",
      description: "Research, flows, and the approved experience for the rental marketplace.",
      acceptanceCriteria: "Rentique approves the UX scope and primary flows.",
      dueDate: "To be agreed after discovery",
    },
    {
      id: "D2",
      title: "MVP Application",
      description: "Tenant, landlord, and administrator workflows for the MVP.",
      acceptanceCriteria: "The MVP is accepted in staging.",
      dueDate: "To be agreed after discovery",
    },
    {
      id: "D3",
      title: "QA, Deployment & Handover",
      description: "Release, documentation, and handover.",
      acceptanceCriteria: "Critical agreed defects are resolved and handover materials are delivered.",
      dueDate: "To be agreed after discovery",
    },
  ],
  milestones: [
    { id: "M1", title: "Discovery & Planning" },
    { id: "M2", title: "Design & Development" },
    { id: "M3", title: "Testing & Launch" },
  ],
  roles: [
    {
      role: "Provider",
      name: "MPAARS project lead",
      responsibilities: "Day-to-day delivery, status reporting, and risk management",
    },
    {
      role: "Client Sponsor",
      name: "Rentique sponsor",
      responsibilities: "Budget owner and final escalation point",
    },
    {
      role: "Client Approver",
      name: "Rentique approver",
      responsibilities: "Reviews and approves deliverables",
    },
  ],
  workstreams: [
    "Discovery and UX for the rental marketplace",
    "MVP application for tenants, landlords, and administrators",
    "QA, deployment, documentation, and handover",
  ],
  sowNumber: "RNTQ-SOW-001",
  clientName: "Rentique",
  projectName: "Rentique Rental Marketplace — MVP",
};

function listText(doc: { content?: { type?: string; content?: unknown[] }[] }) {
  const items: string[] = [];
  const walk = (node: { type?: string; text?: string; content?: { type?: string; text?: string; content?: unknown[] }[] }) => {
    if (node.type === "listItem") {
      const text = JSON.stringify(node);
      const match = text.match(/"text":"([^"]+)"/);
      if (match) items.push(match[1]);
    }
    for (const child of node.content ?? []) walk(child as typeof node);
  };
  for (const child of doc.content ?? []) walk(child as never);
  return items;
}

describe("native SOW template fill", () => {
  const template = getDocumentTemplate("sow");
  if (!template) throw new Error("SOW template missing");

  function build() {
    return template!.build({
      title: "Statement of Work — Rentique Rental Marketplace",
      orgName: "MPAARS Private Limited",
      client: { id: "client", label: "Rentique", type: "client" },
      project: { id: "project", label: "Rentique Rental Marketplace — MVP", type: "project" },
    });
  }

  it("writes each Rentique row into its own table cells", () => {
    const filled = applyDocumentData(build(), rentique);
    const deliverables = readTable(filled, "deliverables");
    const body = deliverables.slice(1);
    expect(body.map((row) => row[0])).toEqual(["D1", "D2", "D3"]);
    expect(body[0][1]).toContain("Discovery & UX");
    expect(body[0][1]).toContain("Research, flows");
    expect(body[0][2]).toBe("Rentique approves the UX scope and primary flows.");
    expect(body[1][1]).toContain("MVP Application");
    expect(body[1][1]).not.toContain("Discovery & UX");
    expect(body[2][1]).toContain("QA, Deployment & Handover");
    expect(new Set(body.map((row) => row[1])).size).toBe(3);
    expect(new Set(body.map((row) => row[2])).size).toBe(3);

    const milestones = readTable(filled, "milestones").slice(1);
    expect(milestones.map((row) => row[1])).toEqual([
      "Discovery & Planning",
      "Design & Development",
      "Testing & Launch",
    ]);
    expect(milestones[0][2]).toBe("[Date]");
    expect(milestones[0][3]).toBe("[Date]");

    const roles = readTable(filled, "roles").slice(1);
    expect(roles.map((row) => row[1])).toEqual(["MPAARS project lead", "Rentique sponsor", "Rentique approver"]);
    expect(roles.map((row) => row[2])).toEqual([
      "Day-to-day delivery, status reporting, and risk management",
      "Budget owner and final escalation point",
      "Reviews and approves deliverables",
    ]);
    expect(roles[0][2]).not.toContain("Rentique approver");

    const payments = readTable(filled, "payments").slice(1);
    expect(payments.map((row) => row[0])).toEqual(["Signature", "M2 complete", "M3 complete", "Total"]);
    expect(payments.map((row) => row[2])).toEqual(["[$0]", "[$0]", "[$0]", "[$0]"]);

    const scope = listText(filled).filter((item) => rentique.workstreams.includes(item));
    expect(scope).toEqual(rentique.workstreams);

    const warnings = documentWarnings(filled, {
      title: "Statement of Work — Rentique Rental Marketplace",
      clientId: "client",
      projectId: "project",
    });
    expect(warnings.readyForSignature).toBe(false);
    expect(warnings.warnings.join("\n")).toMatch(/MSA dated/);
    expect(warnings.warnings.join("\n")).toMatch(/Fixed fee/);
    expect(warnings.warnings.join("\n")).toMatch(/\$0/);
    expect(JSON.stringify(filled)).not.toContain("[Deliverable]");
    expect(JSON.stringify(filled)).not.toContain("[Service or workstream]");
    expect(JSON.stringify(filled)).toContain("[MSA dated …]");
    expect(JSON.stringify(filled)).toContain("RNTQ-SOW-001");
    expect(JSON.stringify(filled)).toContain("MPAARS Private Limited");
  });

  it("does not copy one deliverable, workstream, or role name into every row", () => {
    const filled = applyDocumentData(build(), {
      Deliverable: "QA, deployment, documentation and handover",
      "Measurable criteria": "Critical agreed defects are resolved",
      "Service or workstream": "Third-party integrations, QA, deployment, documentation and handover.",
      Name: "Rentique nominated approver",
      $0: "To be agreed",
    });
    const deliverables = readTable(filled, "deliverables").slice(1);
    expect(deliverables.every((row) => row[1] === "[Deliverable]")).toBe(true);
    expect(deliverables.every((row) => row[2] === "[Measurable criteria]")).toBe(true);
    const roles = readTable(filled, "roles").slice(1);
    expect(roles.every((row) => row[1] === "[Name]")).toBe(true);
    expect(roles[0][2]).toBe("Day-to-day delivery, status reporting, risk management");
    expect(listText(filled).filter((item) => item.includes("Third-party"))).toEqual([]);
    const payments = readTable(filled, "payments").slice(1);
    expect(payments.every((row) => row[2] === "[$0]")).toBe(true);
  });

  it("reports a lead that has not been converted", () => {
    const warnings = documentWarnings(build(), {
      title: "Statement of Work — Rentique Rental Marketplace",
      clientId: null,
      projectId: null,
      leadId: "154f2989-62bc-4806-a92f-11b5846a8f58",
    });
    expect(warnings.readyForSignature).toBe(false);
    expect(warnings.warnings.join("\n")).toMatch(/has not been converted to a client/);
    expect(warnings.warnings.join("\n")).toMatch(/No project is linked/);
  });
});
