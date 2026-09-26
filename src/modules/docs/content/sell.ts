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
        text: "Each client has a **Billing details** card on their page with the legal name, contact person or team, tax ID, billing email, phone, address, and extra fields like PAN or vendor code. Click **Add** or **Edit** to fill it in. Every new invoice for that client starts with these details in **Billed to**. You can also save them from an invoice by ticking **Save as {client}'s billing details**. Issued invoices keep the details they were issued with. See [Invoices](/docs/invoices).",
      },
      { type: "h2", text: "Archive or delete" },
      {
        type: "p",
        text: "From the **…** menu choose **Archive** to take a client off the active list while keeping all history. **Delete client** (in Edit profile) is only possible when the client has no projects, charges, invoices, or payments — otherwise archive instead. Leads and documents linked to a deleted client are kept and simply unlinked.",
      },
    ],
  },
  {
    slug: "email-tracking",
    title: "Send and track emails",
    summary:
      "Send tracked emails from Worklane, or paste an invisible pixel into emails you write in Gmail, Outlook, or Apple Mail, and see when they're opened.",
    category: "sell",
    kind: "how-to",
    related: ["leads", "notifications"],
    blocks: [
      {
        type: "p",
        text: "**Emails** (under Sell in the sidebar) tracks when your emails are opened. Every tracked email carries an invisible 1×1 image hosted by Worklane. When the recipient's mail app loads it, the open is recorded against your studio and against you. You can send an email from Worklane with **Compose**, or use **Track an email** to get a pixel for an email you send from your own mail app.",
      },
      {
        type: "table",
        head: ["", "Compose", "Track an email (pixel)"],
        rows: [
          ["Sent from", "Your studio's address, with replies going to your own email", "Your own Gmail, Outlook, or Apple Mail"],
          ["Setup", "None. Tracking is built in", "Paste the pixel into each email"],
          ["In your Sent folder", "No. The email is kept on the Emails page", "Yes"],
          ["Your own opens", "Never counted", "Filtered out; remove any stragglers with **This was me**"],
        ],
      },
      { type: "h2", text: "Send an email from Worklane" },
      {
        type: "steps",
        items: [
          { title: "Open Emails and click Compose", body: "Needs email sending set up on the workspace and edit access to the studio." },
          {
            title: "Pick the recipient",
            body: "Type an address or pick one of your leads or client contacts from the suggestions. Click **Add CC** for up to 5 more addresses.",
          },
          { title: "Write the subject and message", body: "Links you type become clickable." },
          {
            title: "Click Send (or press ⌘ Enter)",
            body: "The email opens on the Emails page so you can watch for the first open. If the recipient is a lead, the email is also logged on the lead's timeline.",
          },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Emails from Compose come from the studio's sending address with your name on them, and replies go to your own email. You can send up to 40 every 10 minutes.",
      },
      {
        type: "callout",
        tone: "note",
        title: "Why you copy it instead of downloading it",
        text: "A saved image file can't report anything. Tracking only works when the recipient's mail app fetches the image from Worklane, so each email gets its own hosted pixel that you paste into the body.",
      },
      { type: "h2", text: "Track an email from your own mail app" },
      {
        type: "steps",
        items: [
          { title: "Open Emails and click Track an email", body: "" },
          {
            title: "Add details (optional)",
            body: "A **Subject** so you recognise the email later, and the **Recipient**. If the recipient matches a lead's email, the opens are linked to that lead.",
          },
          {
            title: "Click Create and copy pixel",
            body: "The pixel is now on your clipboard, and the dialog shows the paste steps for your mail app.",
          },
        ],
      },
      { type: "h2", text: "Paste it into your email" },
      {
        type: "p",
        text: "Write your email as usual, then paste the pixel anywhere in the body. Just above your signature works well. Nothing visible appears, because the image is invisible.",
      },
      { type: "h3", text: "Gmail" },
      {
        type: "list",
        items: [
          "Click in the message body and press **⌘V** (**Ctrl+V** on Windows).",
          "Don't turn on **Plain text mode** (⋮ menu in the compose window). It strips images, including the pixel.",
        ],
      },
      { type: "h3", text: "Outlook on the web and the new Outlook" },
      {
        type: "list",
        items: [
          "Click in the body and press **⌘V** or **Ctrl+V**.",
          "The message must be HTML. If it's plain text, use the compose window's **⋯** menu → **Switch to HTML**.",
        ],
      },
      { type: "h3", text: "Outlook classic" },
      {
        type: "steps",
        items: [
          { title: "Try pasting first", body: "Click in the body and press **Ctrl+V**. This usually works." },
          { title: "If nothing is inserted, click Copy link only", body: "In Worklane, on the pixel dialog or the email's panel." },
          {
            title: "Insert → Pictures → This Device",
            body: "Paste the link into the **File name** box.",
          },
          {
            title: "Choose Link to File",
            body: "Open the arrow next to **Insert** and pick **Link to File**. A plain **Insert** embeds a copy, which can't report opens.",
          },
        ],
      },
      { type: "h3", text: "Apple Mail" },
      {
        type: "list",
        items: [
          "Click in the body and press **⌘V**.",
          "The message must be Rich Text (the default). If it isn't, choose **Format → Make Rich Text**.",
        ],
      },
      { type: "h3", text: "Phone mail apps" },
      {
        type: "p",
        text: "Most phone apps can't paste images from the clipboard. Write the email on a computer and paste the pixel there, or save it as a draft and send it from your phone later.",
      },
      { type: "h2", text: "See who opened it" },
      {
        type: "list",
        items: [
          "Each email shows **Opened** or **Not opened yet**. Use the **Opened** and **Not opened** filters to find emails worth a follow-up.",
          "The stats row shows **Tracked**, **Open rate**, **Opened this week**, and **Not opened**.",
          "Click an email to see its open count, first and last open, and which mail app opened it each time. Here you can also edit the subject and recipient, copy the pixel again, or delete it.",
          "You're notified the first time an email is opened, under **Tracked emails**. Email alerts for this category are off by default; turn them on in [notification settings](/docs/notifications).",
        ],
      },
      {
        type: "table",
        head: ["Who", "Sees"],
        rows: [
          ["Members", "Only the emails they tracked."],
          ["Owners and admins", "Their own emails under **Mine**, and the whole studio's under **Everyone**, with who sent each one."],
        ],
      },
      { type: "h2", text: "Tips" },
      {
        type: "list",
        items: [
          "Use a new pixel for every email. Reusing one mixes the opens of different emails together.",
          "Opens in the 2 minutes after you copy a pixel aren't counted, so pasting it into your draft doesn't register as an open. Opens from the network you use Worklane on are ignored too.",
          "If you open the email yourself later (for example from your Sent folder), click **This was me** next to that open on the email's panel. It's removed, and opens from the same place won't count again.",
          "Replies and forwards can carry the pixel along in the quoted text, so later opens of the thread may add extra opens.",
          "Lost the pixel? Open the email on the Emails page and click **Copy pixel again**.",
        ],
      },
      { type: "h2", text: "How accurate is it?" },
      {
        type: "list",
        items: [
          "**Apple Mail privacy protection** loads images automatically, so an email can show as opened even if nobody read it.",
          "**Recipients who block images** (common in corporate Outlook) never trigger the pixel, so a real read can show as not opened.",
          "**Gmail** loads images through its own servers. Viewing the email in your own Sent folder can count as an open; remove it with **This was me**.",
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "Treat an open as a strong hint that the email was seen, not proof that it was read.",
      },
    ],
  },
];
