import type { DocArticle } from "../types";

export const SELL: DocArticle[] = [
  {
    slug: "leads",
    title: "Track leads on your pipeline",
    summary:
      "Capture opportunities, move them through stages on the board, and keep notes, contacts, and files on each deal.",
    category: "sell",
    kind: "how-to",
    related: ["lead-journey", "convert-a-lead", "mentions"],
    blocks: [
      {
        type: "p",
        text: "**Leads** holds opportunities before they become clients. You can work from the **Board view** (one column per stage) or the **List view** (searchable table with pipeline totals).",
      },
      { type: "h2", text: "Create a lead" },
      {
        type: "steps",
        items: [
          { title: "Click New lead", body: "From the Leads page, the **+ Create** menu, or ⌘K → “New lead”." },
          {
            title: "Fill in the deal",
            body: "**Name** is required. Add **Company**, **Stage**, **Expected close**, and **Estimated value** (USD or INR).",
          },
          {
            title: "Add context",
            body: "Write **Notes** — call notes, next steps — and type **@** to tag teammates, clients, or projects. Drop proposals or screenshots into the attachments area (up to 12 MB each).",
          },
          {
            title: "Add contact and source",
            body: "Fill in **Person**, **Email**, **Phone**, **WhatsApp**, where it **Came from** (Referral, Upwork…), and **Tags** separated by commas.",
          },
          { title: "Click Create lead", body: "You become the lead's owner. Studio owners are notified, and anyone you @mentioned gets a notification." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "**Estimated value** and the **Pipeline** total are only shown to people with Finance access. Everyone else still sees the lead and its stage.",
      },
      { type: "h2", text: "Move leads through stages" },
      {
        type: "list",
        items: [
          "In Board view, drag a card to another column to change its stage, or up and down to reorder within a column.",
          "On touch screens, press and hold a card for a moment before dragging — normal swipes still scroll the board.",
          "Moving a lead notifies its owner: “Alex moved Acme rebrand to Proposal”.",
          "Won leads that haven't been converted show a **Become a client →** link right on the card.",
        ],
      },
      { type: "h2", text: "Find leads" },
      {
        type: "p",
        text: "Switch to **List view** to search by lead name, company, contact person, or email. The stats row shows **Open**, **Pipeline**, **Won**, and **All** counts.",
      },
      { type: "h2", text: "Edit or delete a lead" },
      {
        type: "p",
        text: "Click any card or row to open the lead sheet. Change what you need and click **Save changes**. To delete, click **Delete** and type the lead's name to confirm — this removes the lead, its notes, and attachments. A client already created from the lead is kept.",
      },
      {
        type: "callout",
        tone: "warning",
        text: "Deleting requires the **Delete** permission on Leads (owners and admins always have it). Most teammates should move dead deals to **Lost** instead so your win rate stays honest.",
      },
    ],
  },
  {
    slug: "lead-journey",
    title: "Customize your lead stages",
    summary: "Rename, reorder, add, or remove the stages on your lead journey to match how your studio sells.",
    category: "sell",
    kind: "how-to",
    related: ["leads", "convert-a-lead"],
    blocks: [
      {
        type: "p",
        text: "New studios start with **New → Contacted → Discovery → Qualified → Proposal → Negotiation → Won → Lost**. You can reshape everything except the two closing stages.",
      },
      {
        type: "steps",
        items: [
          { title: "Open Leads and click Journey", body: "You need Edit access to Leads." },
          { title: "Rename a stage", body: "Click its name, type the new one, and click **Save**." },
          { title: "Reorder", body: "Use the up and down arrows beside each stage." },
          {
            title: "Add a stage",
            body: "Type in the **New stage** field (for example “Demo booked”) and click **Add stage**. New stages are placed before Won and Lost.",
          },
          {
            title: "Remove a stage",
            body: "Click the trash icon and confirm. Leads in that stage move to another stage — nothing is deleted.",
          },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "**Won** and **Lost** always stay at the end and can't be removed, and you must keep at least one stage.",
      },
    ],
  },
  {
    slug: "convert-a-lead",
    title: "Win a lead and turn it into a client",
    summary:
      "One click creates the client, its primary contact, and a starter project from everything you captured on the lead.",
    category: "sell",
    kind: "how-to",
    related: ["leads", "clients", "projects"],
    blocks: [
      {
        type: "p",
        text: "Conversion is the heart of the lane: the company, contact, notes, currency, and deal value you captured while selling carry straight into delivery. No retyping.",
      },
      {
        type: "steps",
        items: [
          { title: "Open the lead", body: "Click its card on the board or its row in the list." },
          {
            title: "Find the convert card",
            body: "It reads **Deal won** when the lead is in Won, or **Ready to convert?** otherwise. You can convert from any stage.",
          },
          { title: "Click Become a client", body: "Worklane creates everything below and opens the new project." },
        ],
      },
      { type: "h2", text: "What gets created" },
      {
        type: "table",
        head: ["Record", "Filled from the lead"],
        rows: [
          ["Client", "Named after the **Company** (or the lead name if no company). Kind is Company or Person accordingly. Notes and currency carry over."],
          ["Primary contact", "Person, email, phone, and WhatsApp from the lead's contact fields."],
          ["Project", "“{Lead} engagement” — status **Planning**, billing **Milestones**, 5% platform fee, contracted amount = estimated value, and you as project lead."],
          ["Lead", "Moved to **Won** and linked to the new client."],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "The starter project is just a starting point — open **Project settings** to change the billing mode, fee, or dates, then add your first milestone.",
      },
      {
        type: "p",
        text: "After conversion the lead shows **Open client** instead, so you can always jump from the original deal to the client record.",
      },
    ],
  },
  {
    slug: "clients",
    title: "Manage clients and contacts",
    summary:
      "Create clients, keep contacts current, see what each client owes, and archive or delete safely.",
    category: "sell",
    kind: "how-to",
    related: ["convert-a-lead", "projects", "record-payments"],
    blocks: [
      {
        type: "p",
        text: "A client is who you work with and bill. Every project, charge, invoice, and document hangs off a client, so its profile is the fastest place to see the whole relationship.",
      },
      { type: "h2", text: "Create a client" },
      {
        type: "steps",
        items: [
          { title: "Click New client", body: "From Clients, **+ Create**, or ⌘K." },
          { title: "Choose Kind", body: "**Company** or **Person**." },
          { title: "Name and currency", body: "Enter the **Name** and pick **USD** or **INR**. Every charge and payment for this client uses that currency." },
          { title: "Internal notes", body: "Private notes for your team — never shown on the client portal." },
          { title: "Primary contact (optional)", body: "Contact name, Email, Phone, WhatsApp." },
          { title: "Click Create client", body: "" },
        ],
      },
      { type: "h2", text: "The clients list" },
      {
        type: "list",
        items: [
          "Search by name, and filter by balance (**All clients / Owing / Settled**) and kind (**Company / Person**).",
          "Switch between **Card view** and **List view**. The list shows **Projects**, **Due**, and quick **Projects** / **Collect** links.",
          "Stats across the top: **Clients**, **Owing**, **Due total**, and active **Projects**.",
        ],
      },
      { type: "h2", text: "The client profile" },
      {
        type: "p",
        text: "The header shows the kind, how much is due, and the project count. A **next step** card suggests the one thing to do: **New project**, **Collect**, **Add contact**, or **Open project**.",
      },
      {
        type: "table",
        head: ["Panel", "What's in it"],
        rows: [
          ["Projects", "Every project for this client, with **New** to start another."],
          ["Money", "Charges and a collect form to record payments right here."],
          ["Activity", "The latest events on this client."],
          ["Details", "Kind, status (Outstanding / Current / New), currency, primary contact, notes."],
          ["Contacts", "Add people with **Add contact**. Tick **Primary** to make one the main contact."],
          ["Documents", "Proposals and SOWs for this client, with **New** to draft one."],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        title: "Billing details",
        text: "A client's billing identity (legal name, tax ID, billing address, billing email) is saved from an invoice's **Billed to** section. Tick **Save as {client}'s billing details** once, and every new invoice for that client starts with it. See [Invoices](/docs/invoices).",
      },
      { type: "h2", text: "Archive or delete" },
      {
        type: "p",
        text: "From the **…** menu choose **Archive** to take a client off the active list while keeping all history. **Delete client** (in Edit profile) is only possible when the client has no projects, charges, invoices, or payments — otherwise archive instead. Leads and documents linked to a deleted client are kept and simply unlinked.",
      },
    ],
  },
];
