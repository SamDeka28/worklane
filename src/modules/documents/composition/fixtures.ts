import { block, nextBlockId, type CompositionDocument } from "@/modules/documents/composition/schema";

/** An example requirements document. The product name is data, not a special renderer. */
export function exampleRequirementsDocument(): CompositionDocument {
  return {
    schemaVersion: 1,
    type: "document",
    kind: "prs",
    template: { id: "professional-prs", version: 1 },
    theme: { id: "professional-blue", version: 1 },
    metadata: {
      title: "Queless",
      subtitle: "Software & Product Requirements Specification",
      client: "Queless",
      author: "MPAARS Private Limited",
      date: "2026-10-05",
    },
    page: { size: "A4", orientation: "portrait", margin: { top: 36, right: 36, bottom: 44, left: 36 } },
    header: { show: true, text: "Queless · SRS/PRS" },
    footer: { show: true, text: "Queless | SRS/PRS v1.0" },
    sections: [
      {
        id: nextBlockId("s"),
        blocks: [
          block("columns", {}, [
            block("stack", {}, [
              block("heading", { text: "Queless", level: 1 }),
              block("paragraph", { text: "Software & Product Requirements Specification" }),
              block("paragraph", { text: "Smart queue management for modern healthcare." }),
              block("paragraph", { text: "Prepared by MPAARS Private Limited for Queless." }),
            ]),
            block("image", { src: "https://example.com/queue-app.png", alt: "Queue app", frame: "phone" }),
          ]),
          block("page-break", {}),
          block("columns", {}, [
            block("stack", {}, [
              block("heading", { text: "Executive summary", level: 2 }),
              block("paragraph", { text: "A queue platform for clinics. It shortens waiting time and keeps patients informed." }),
              block("numbered", { items: ["Digital check-in", "Live position and ETA", "Staff and doctor tools"] }),
            ]),
            block("stack", {}, [
              block("grid", { columns: 2 }, [
                block("card", { icon: "clock", title: "Shorter waits", body: "Patients see their place in line." }),
                block("card", { icon: "spark", title: "Clear handoff", body: "Staff call the next person." }),
              ]),
              block("grid", { columns: 3 }, [
                block("card", { title: "Waits", figure: "50%", body: "Less waiting" }),
                block("card", { title: "Arrival", figure: "90%", body: "On-time arrival" }),
                block("card", { title: "ETA", figure: "< 2s", body: "Status refresh" }),
              ]),
            ]),
          ]),
          block("page-break", {}),
          block("heading", { text: "Architecture", level: 2 }),
          block("diagram", {
            layout: "stack",
            nodes: [
              { id: "apps", label: "Apps", caption: "Patient, web, doctor" },
              { id: "edge", label: "Edge", caption: "Load balancer" },
              { id: "services", label: "Services", caption: "Queue, notify, auth" },
              { id: "data", label: "Data", caption: "Database and workers" },
            ],
            edges: [
              { from: "apps", to: "edge" },
              { from: "edge", to: "services" },
              { from: "services", to: "data" },
            ],
          }),
          block("heading", { text: "Queue lifecycle", level: 2 }),
          block("diagram", {
            layout: "row",
            nodes: [
              { id: "in", label: "Check-in" },
              { id: "wait", label: "In queue" },
              { id: "call", label: "Called" },
              { id: "done", label: "Completed" },
            ],
            edges: [
              { from: "in", to: "wait" },
              { from: "wait", to: "call" },
              { from: "call", to: "done" },
            ],
          }),
          block("heading", { text: "Requirements", level: 2 }),
          block("table", {
            columns: [
              { key: "id", label: "ID" },
              { key: "title", label: "Requirement" },
              { key: "detail", label: "Description" },
            ],
            rows: [
              { id: "P-01", title: "Join a queue", detail: "A patient checks in and receives a position." },
              { id: "P-02", title: "Track ETA", detail: "The app shows an updated estimate." },
            ],
          }),
          block("heading", { text: "Data model", level: 2 }),
          block("diagram", {
            layout: "hub",
            nodes: [
              { id: "patient", label: "Patient", fields: [{ name: "id", key: "pk" }, { name: "name" }] },
              { id: "visit", label: "Visit", fields: [{ name: "id", key: "pk" }, { name: "patient_id", key: "fk" }] },
              { id: "clinic", label: "Clinic", fields: [{ name: "id", key: "pk" }, { name: "name" }] },
            ],
            edges: [
              { from: "visit", to: "patient" },
              { from: "visit", to: "clinic" },
            ],
          }),
          block("heading", { text: "Integrations", level: 2 }),
          block("diagram", {
            layout: "hub",
            nodes: [
              { id: "core", label: "Platform" },
              { id: "sms", label: "SMS" },
              { id: "mail", label: "Email" },
              { id: "cal", label: "Calendar" },
            ],
            edges: [
              { from: "core", to: "sms" },
              { from: "core", to: "mail" },
              { from: "core", to: "cal" },
            ],
          }),
          block("heading", { text: "Technology", level: 2 }),
          block("table", {
            columns: [
              { key: "layer", label: "Layer" },
              { key: "choice", label: "Technology" },
            ],
            rows: [
              { layer: "Client", choice: "Mobile and web" },
              { layer: "Data", choice: "Relational database" },
            ],
          }),
          block("callout", { text: "ETA = patients ahead × average consult time + buffer." }),
          block("heading", { text: "Implementation", level: 2 }),
          block("diagram", {
            layout: "timeline",
            nodes: [
              { id: "p1", label: "Discovery", caption: "2 weeks" },
              { id: "p2", label: "MVP", caption: "6 weeks" },
              { id: "p3", label: "Pilot", caption: "2 weeks" },
              { id: "p4", label: "Production", caption: "2 weeks" },
            ],
            edges: [
              { from: "p1", to: "p2" },
              { from: "p2", to: "p3" },
              { from: "p3", to: "p4" },
            ],
          }),
        ],
      },
    ],
  };
}

/** A different document on another theme, using the same primitives. */
export function exampleProposalDocument(): CompositionDocument {
  return {
    schemaVersion: 1,
    type: "document",
    kind: "proposal",
    template: { id: "professional-proposal", version: 1 },
    theme: { id: "ink", version: 1 },
    metadata: {
      title: "Northwind website proposal",
      client: "Northwind",
      author: "Studio",
    },
    page: { size: "LETTER", orientation: "portrait", margin: { top: 40, right: 40, bottom: 48, left: 40 } },
    header: { show: true, text: "Northwind proposal" },
    footer: { show: true, text: "Proposal v1" },
    sections: [
      {
        id: nextBlockId("s"),
        blocks: [
          block("columns", {}, [
            block("heading", { text: "Northwind website", level: 1 }),
            block("card", { title: "Investment", figure: "$24,000", body: "Fixed fee" }),
          ]),
          block("table", {
            columns: [
              { key: "phase", label: "Phase" },
              { key: "fee", label: "Fee" },
            ],
            rows: [
              { phase: "Design", fee: "$8,000" },
              { phase: "Build", fee: "$16,000" },
            ],
          }),
          block("signature", { left: "Studio", right: "Northwind" }),
        ],
      },
    ],
  };
}
