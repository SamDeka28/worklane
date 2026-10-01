import type { DocArticle } from "../types";

export const SELL: DocArticle[] = [
  {
    slug: "leads",
    title: "Track leads on your pipeline",
    summary:
      "Capture opportunities, move them through stages, set next steps, log calls and emails, and keep notes and proposals on each deal.",
    category: "sell",
    kind: "how-to",
    related: ["lead-journey", "convert-a-lead", "email-tracking", "mentions"],
    blocks: [
      {
        type: "p",
        text: "**Leads** holds opportunities before they become clients. Switch between **Board view** (one column per stage), **List view** (a table with next steps, owners, and pipeline totals), and **Reports**.",
      },
      { type: "h2", text: "Create a lead" },
      {
        type: "steps",
        items: [
          {
            title: "Click New lead",
            body: "From the Leads page, the **+ Create** menu, ⌘K → “New lead”, or **Add a lead** at the bottom of any open column on the board (the lead starts in that stage).",
          },
          {
            title: "Fill in the deal",
            body: "**Name** is required. Add **Company**, **Stage**, **Expected close**, and **Estimated value** in the lead's currency.",
          },
          {
            title: "Set the first next step",
            body: "Under **Next step**, say what happens next (for example “Intro call”) and pick **Today**, **Tomorrow**, **In 3 days**, **Next week**, or a date.",
          },
          {
            title: "Add context",
            body: "Write **Notes** and type **@** to tag teammates, clients, or projects. Drop proposals or screenshots into **Attachments** (up to 12 MB each).",
          },
          {
            title: "Add owner, contact, and source",
            body: "**Owner** defaults to you; pick a teammate or **Unassigned**. Fill in **Person**, **Email**, **Phone**, **WhatsApp**, where it **Came from** (suggestions come from your lead sources), and **Tags** separated by commas.",
          },
          {
            title: "Click Create lead",
            body: "Studio owners are notified, the owner is notified if it isn't you, and anyone you @mentioned gets a notification.",
          },
        ],
      },
      {
        type: "callout",
        tone: "tip",
        title: "This might already exist",
        text: "While you type, Worklane checks for leads and clients with the same email, phone, or name. If it finds a client, click **New deal for this client** to link the lead to them. It then converts straight into that client.",
      },
      {
        type: "callout",
        tone: "note",
        text: "**Estimated value** and pipeline totals are only shown to people with Finance access. Everyone else still sees the lead and its stage.",
      },
      { type: "h2", text: "Start a lead by emailing them" },
      {
        type: "p",
        text: "If your first step is an email anyway, skip the form. Click **Email a new lead** on the Leads page (also in the **+ Create** menu and the ⌘K search), enter the address, and write the email or pick a template. **Name** and **Company** are optional; for work addresses the company is filled in from the email domain. Click **Send and create lead** (or press ⌘ Enter).",
      },
      {
        type: "list",
        items: [
          "The lead is created with you as owner and **Outbound email** as the source, in your second stage (for example Contacted) unless you untick **Put the lead in**.",
          "The email is sent from Worklane, logged on the lead's timeline, and tracked unless you untick **Track opens and notify me**.",
          "**Follow up if no reply in** sets the lead's next step.",
          "If the address already belongs to a lead, you'll see a warning with **Open it instead**. If the email can't be sent, no lead is created.",
        ],
      },
      { type: "h2", text: "Move leads through stages" },
      {
        type: "list",
        items: [
          "In Board view, drag a card to another column to change its stage, or up and down to reorder within a column. You can also change **Stage** in the lead sheet.",
          "On touch screens, press and hold a card for a moment before dragging. Normal swipes still scroll the board.",
          "Dragging a lead to another stage notifies its owner, for example “Alex moved Acme rebrand to Proposal”.",
          "Dropping a lead on **Won** asks whether to make it a client. Click **Not yet** to just mark it won. See [Win a lead and turn it into a client](/docs/convert-a-lead).",
          "Dropping a lead on **Lost** asks **Why was it lost?** Pick a reason, add an optional note, and click **Mark as lost**. Cancel puts the card back.",
          "Moving a lead to Won or Lost clears its next step.",
        ],
      },
      { type: "h2", text: "Next steps and follow-ups" },
      {
        type: "p",
        text: "Every open lead should have a **Next step** with a due date. It shows on the board card and in the list, red when overdue and amber when due today. In the lead sheet, click **Done** when it's finished (it's logged on the timeline), the pencil to reschedule, or × to clear it.",
      },
      {
        type: "p",
        text: "Open leads with no calls, emails, or stage moves for 14 days get a **quiet** badge (for example “16d quiet”). Change the number of days in CRM settings.",
      },
      { type: "h2", text: "Find leads" },
      {
        type: "list",
        items: [
          "**Search leads** matches lead name, company, contact person, or email.",
          "Filter by owner (**Everyone**, **My leads**, **Unassigned**, or a teammate), follow-up (**Overdue**, **Due today**, **Gone quiet**, **No next step**), source, and tag.",
          "**List view** shows each lead's **Next step**, **Owner**, **Stage**, and **Value**. The stats row shows **Open**, **Pipeline** (open leads only), **Overdue**, and **Won**.",
        ],
      },
      { type: "h2", text: "The lead sheet" },
      {
        type: "p",
        text: "Click any card or row to open the lead sheet. Change what you need and click **Save changes**.",
      },
      {
        type: "table",
        head: ["Tab", "What's in it"],
        rows: [
          ["Overview", "**Send email**, the **Next step** card, the deal fields, **Owner** (changes save right away and notify the new owner), contact and source, and the convert card."],
          ["Timeline", "Log a **Call**, **Email**, **Meeting**, **Message**, or **Note** with the day it happened. The timeline also shows stage moves, emails sent from Worklane with their open status, enquiry form messages, and proposals sent or accepted."],
          ["Notes & files", "Rich notes with @mentions, and attachments."],
          ["Proposals", "Proposals, SOWs, contracts, and NDAs linked to this lead. Click **New**, pick a template, and click **Create draft**."],
        ],
      },
      {
        type: "list",
        items: [
          "Sending a linked proposal logs it on the timeline and moves the lead to your **Proposal** stage if it's earlier in the pipeline. When the client accepts or signs, a **Mark as won** banner appears.",
          "You can remove timeline entries you logged. People with the Delete permission on Leads can remove anyone's. Sent emails and form enquiries can't be removed.",
          "Click **Activity** in the sheet header to see the lead's full change history, and **Back to details** to return.",
        ],
      },
      { type: "h2", text: "Email a lead" },
      {
        type: "p",
        text: "Click **Send email** in the lead sheet. Worklane suggests one of your email templates based on where the lead is, and fills in names from the lead. Under **After sending** you can set **Follow up if no reply in** 2 days to 2 weeks (this becomes the next step), **Move to** the next stage when the lead is in your first stage, and **Track opens and notify me**. The email is logged on the timeline. See [Send and track emails](/docs/email-tracking).",
      },
      { type: "h2", text: "Insert variables" },
      {
        type: "p",
        text: "Variables are filled in with the lead's details when the email is sent, so a template works for every lead. In the subject or message of **Send email** or **Email a new lead**:",
      },
      {
        type: "list",
        items: [
          "Type **@** to open the variable list. Keep typing to filter it, use the arrow keys to pick one, and press **Enter** or **Tab** to insert it. **Esc** closes the list.",
          "Or click a chip under **Insert** (for example **First name** or **Company**) to add it where your cursor is.",
          "A chip is amber when that detail is empty for this lead. If you send anyway, the variable is left out of the email; fill in the detail or reword the sentence first.",
        ],
      },
      {
        type: "table",
        head: ["Variable", "Filled with"],
        rows: [
          ["`{{first_name}}`", "The contact's first name"],
          ["`{{contact_name}}`", "The contact's full name"],
          ["`{{company}}`", "The lead's company"],
          ["`{{lead}}`", "The lead's name"],
          ["`{{my_name}}`", "Your name"],
          ["`{{org_name}}`", "Your studio's name"],
        ],
      },
      { type: "h2", text: "Import leads from a CSV" },
      {
        type: "steps",
        items: [
          { title: "Click the upload icon", body: "It's the **Import leads from CSV** button at the top of the Leads page." },
          { title: "Choose a CSV file", body: "The first row must be column headers. Up to 1,000 rows and 5 MB." },
          {
            title: "Check Match columns",
            body: "Columns are matched automatically. Map at least a name, company, or contact column. Pick an **Owner** and leave **Skip emails already in the CRM** on to avoid duplicates.",
          },
          {
            title: "Click Import",
            body: "Stages are matched by name. Rows with no stage, an unknown stage, or Lost go to your first stage. Values use the studio's default currency, and **Source** defaults to Import.",
          },
        ],
      },
      { type: "h2", text: "Reports" },
      {
        type: "p",
        text: "**Reports** shows your win rate, average **Days to close**, a pipeline funnel from stage history, leads **By source**, **Why deals are lost**, and a **By owner** table. People with Finance access also see the **Weighted forecast**, **Won value**, and **Forecast by close month**.",
      },
      { type: "h2", text: "Delete a lead" },
      {
        type: "p",
        text: "In the lead sheet, click **Delete** and type the lead's name to confirm. This removes the lead, its notes, timeline, and attachments. A client already created from the lead is kept.",
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
    title: "Customize your lead pipeline",
    summary:
      "Rename, reorder, add, or remove lead stages, and set win probabilities, lost reasons, sources, email templates, and a public enquiry form.",
    category: "sell",
    kind: "how-to",
    related: ["leads", "convert-a-lead"],
    blocks: [
      {
        type: "p",
        text: "New studios start with **New → Contacted → Discovery → Qualified → Proposal → Negotiation → Won → Lost**. You can add, rename, reorder, and remove stages. **Won** and **Lost** can be renamed but not removed.",
      },
      { type: "h2", text: "Edit your stages" },
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
            body: "Click the trash icon and confirm. Leads in that stage move to the first remaining stage. Nothing is deleted.",
          },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Keep **Won** and **Lost** at the end of the journey. Reports, the forecast, and the won and lost prompts rely on them, whatever you name them.",
      },
      { type: "h2", text: "CRM settings" },
      {
        type: "p",
        text: "Click the sliders icon (**CRM settings**) at the top of the Leads page. It has five tabs.",
      },
      {
        type: "table",
        head: ["Tab", "What you can change"],
        rows: [
          ["Pipeline", "**Win probability** for each open stage, which weights the forecast in Reports (Won counts 100%, Lost 0%). **Gone quiet** sets how many days without activity before an open lead gets a quiet badge. The default is 14; 0 turns it off."],
          ["Lists", "**Lost reasons** offered when a lead moves to Lost (keep at least one), and **Lead sources** suggested in “Came from”. One per line, then click **Save lists**."],
          ["Templates", "The templates offered by **Send email** on a lead. Type **@** in a subject or message to insert a variable like `{{first_name}}`, `{{company}}`, or `{{my_name}}` (see [Insert variables](/docs/leads)). Click **Add template**, then **Save templates**. **Reset** restores the built-in set. The panel widens on this tab to give you room. Leave signatures out of templates: your [signature](/docs/email-tracking) is added below each email for you."],
          ["Mailbox", "Connect your own mailbox (Gmail, Outlook, or any SMTP server) so your lead emails come from you and replies land in your inbox. Members need an owner or admin to turn on **Own mailbox** in their Team access first. See [Choose the address emails come from](/docs/email-tracking)."],
          ["Form", "A public enquiry form that creates leads. See below."],
        ],
      },
      { type: "h2", text: "Collect enquiries with a public form" },
      {
        type: "steps",
        items: [
          { title: "Open CRM settings → Form", body: "" },
          { title: "Tick Accept enquiries", body: "Set the **Headline** and **Intro**, and choose whether to **Ask for company**, **Ask for phone**, and **Ask for budget**." },
          {
            title: "Choose where enquiries go",
            body: "Pick an **Owner**, or leave **Unassigned (notify managers)**. Set the **Source label** (Website form by default).",
          },
          {
            title: "Click Save form",
            body: "Your link appears. Copy it, open it, or click **Copy embed code for your website**.",
          },
        ],
      },
      {
        type: "p",
        text: "Each submission becomes a lead in your first stage with the next step “Reply to form enquiry” due today. The message is logged on the timeline as a **Form enquiry**, and the owner (or your managers) is notified. Click **New link** to replace the link; the old one stops working. While the form is switched off, the link shows “not found”.",
      },
    ],
  },
  {
    slug: "convert-a-lead",
    title: "Win a lead and turn it into a client",
    summary:
      "Create the client (or add to an existing one), its contact, and a starter project from everything you captured on the lead.",
    category: "sell",
    kind: "how-to",
    related: ["leads", "clients", "projects"],
    blocks: [
      {
        type: "p",
        text: "Conversion is the heart of the lane: the company, contact, notes, currency, deal value, and proposals you captured while selling carry straight into delivery. No retyping.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Start the conversion",
            body: "Drag the lead to **Won** on the board, or open the lead and click **Become a client** on the convert card. The card reads **Deal won** when the lead is in Won, or **Ready to convert?** otherwise, so you can convert from any open stage. If the client accepted a linked proposal, you'll also see **Mark as won**.",
          },
          {
            title: "Pick the client",
            body: "Choose **New client** (named after the lead's company) or **Add to an existing client**. If Worklane finds a client with the same email or name, it picks **Add to an existing client** and suggests them.",
          },
          {
            title: "Decide on a project",
            body: "**Start a project** is ticked, with **Project name** set to “{Lead} engagement”. Untick it to create only the client.",
          },
          {
            title: "Click Create client and project",
            body: "Or **Create client** without a project. Worklane opens the new project, or the client if you skipped it. From the board, **Not yet** marks the lead won without converting.",
          },
        ],
      },
      { type: "h2", text: "What gets created" },
      {
        type: "table",
        head: ["Record", "Filled from the lead"],
        rows: [
          ["Client", "Named after the **Company** (or the lead name if no company). Kind is Company or Person accordingly. Notes and currency carry over. Skipped when you add to an existing client."],
          ["Contact", "Person, email, phone, and WhatsApp from the lead. It's the primary contact on a new client. On an existing client it's added as a regular contact, unless a contact with that email already exists."],
          ["Project", "Status **Planning**, billing **Milestones**, 5% platform fee, partners earn when charged, contracted amount = estimated value, and you as project lead."],
          ["Documents", "Proposals and other documents linked to the lead move to the client and the new project."],
          ["Lead", "Moved to **Won** and linked to the client."],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "The starter project is just a starting point. Open **Project settings** to change the billing mode, fee, or dates, then add your first milestone.",
      },
      { type: "h2", text: "Deals for existing clients" },
      {
        type: "p",
        text: "A lead linked to a client (created with **New deal** on the client page, or **New deal for this client**) shows a **Linked client** card with **Open client**. Click **Win and start project** to mark it won and start a project for that client in one step. Converted leads keep the **Open client** button, so you can always jump from the original deal to the client record.",
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
          { title: "Name and currency", body: "Enter the **Name** and pick a **Currency**. Every charge, invoice, and payment for this client uses that currency." },
          { title: "Internal notes", body: "Private notes for your team — never shown on the client portal." },
          { title: "Primary contact (optional)", body: "Contact name, Email, Phone, WhatsApp." },
          { title: "Click Create client", body: "" },
        ],
      },
      { type: "h2", text: "The clients list" },
      {
        type: "list",
        items: [
          "Search by name, filter by kind (**All kinds / Company / Person**), and click **Filter**. People with Finance access can also filter by balance (**All clients / Owing / Settled**).",
          "Switch between **List view** (the default) and **Card view**. The list shows **Projects**, **Due**, and quick **Projects** / **Collect** links under **Next**.",
          "Stats across the top: **Clients**, **Owing**, **Due total**, and **Projects** (active and planning). Money figures only show with Finance access.",
          "Archived clients don't appear in the list.",
        ],
      },
      { type: "h2", text: "The client profile" },
      {
        type: "p",
        text: "The header shows the kind, how much is due, and the project count. The main button and the **next step** card suggest the one thing to do: **New project**, **Collect**, **Add contact**, or **Open project**. The **…** menu has **Edit profile**, **New project**, **New charge**, and **Archive**. Tiles show **Due**, **Collected**, **Projects**, and **Contacts**.",
      },
      {
        type: "table",
        head: ["Panel", "What's in it"],
        rows: [
          ["Projects", "Every project for this client, with **New** to start another."],
          ["Deals", "Leads linked to this client, with their stage and next step. Click **New deal** to track an upsell or repeat work in Leads."],
          ["Money", "Open charges and a collect form to record payments right here (Finance access)."],
          ["Activity", "The 10 latest events on this client."],
          ["Details", "Kind, status (Outstanding / Current / New), currency, primary contact, notes."],
          ["Billing details", "Who you invoice. See below."],
          ["Contacts", "Add people with **Add contact**. Tick **Primary** to make one the main contact."],
          ["Documents", "Proposals and SOWs for this client, with **New** to draft one."],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        title: "Billing details",
        text: "Click **Add** or **Edit** on the **Billing details** card to fill in the **Company or legal name**, **Contact person or team**, **Tax ID**, **Billing email**, **Phone**, **Billing address**, and **Other details** like PAN or vendor code. Every new invoice for that client starts with these details in **Billed to**, and saving also updates the client's draft invoices. You can also save them from an invoice by ticking **Save as {client}'s billing details**. Issued invoices keep the details they were issued with. See [Invoices](/docs/invoices).",
      },
      { type: "h2", text: "Archive or delete" },
      {
        type: "p",
        text: "From the **…** menu choose **Archive** to take a client off the active list while keeping all history. **Delete client** (at the bottom of **Edit profile**) needs the **Delete** permission on Leads and is only possible when the client has no projects, charges, invoices, or payments. Otherwise archive instead. Deleting removes the client and its contacts. Leads and documents linked to it are kept and simply unlinked.",
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
          ["Sent from", "The studio's mailbox, otherwise Worklane's default address", "Your own Gmail, Outlook, or Apple Mail"],
          ["Setup", "A sending address (see below). Tracking is built in", "Paste the pixel into each email"],
          ["In your Sent folder", "No. The email is kept on the Emails page", "Yes"],
          ["Your own opens", "Never counted", "Filtered out; remove any stragglers with **This was me**"],
        ],
      },
      { type: "h2", text: "Send an email from Worklane" },
      {
        type: "steps",
        items: [
          { title: "Open Emails and click Compose", body: "Needs a sending address (see below) and edit access to the studio." },
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
        text: "You can send up to 40 emails from Compose every 10 minutes. The dialog shows the address it will send from.",
      },
      { type: "h2", text: "Add a signature" },
      {
        type: "p",
        text: "Lead emails, **Email a new lead**, and Compose can add a signature below your message, like Gmail does. The composer shows it under the message. Click **Remove** to leave it off one email, or **Edit** to change it in your Profile. Document sends don't add it.",
      },
      {
        type: "table",
        head: ["Who", "Where", "What they set"],
        rows: [
          ["Owners and admins", "**Settings** → **Email signature**", "The studio signature everyone uses by default, and whether people can use their own"],
          ["Everyone who sends email", "**Profile** → **Email signature**", "**Studio signature**, **My own**, or **None**"],
          ["Owners and admins", "**Leads** → **Settings** → **Templates** → **Signature**, or **Signature** on the Emails page", "Whether lead emails or Compose emails get signatures at all"],
        ],
      },
      {
        type: "list",
        items: [
          "Click **Create signature** or **Edit signature** to open the editor in a window, with a live preview beside it filled in with your details. Click **Save signature** to keep it, or **Cancel** to leave it as it was.",
          "The editor works like Gmail's: pick a font and size, and add bold, italic, underline, colour, links, images (click the image button to pick a PNG, JPEG, GIF, or WebP under 2 MB, or drop or paste one in; select it and drag a handle to resize), alignment, and lists.",
          "Type **@** in the editor (at the start of a line or after a space) to pick a field, or click a chip under the editor. Arrow keys move through the menu, **Enter** inserts, **Esc** closes it. Lines left empty (say, no phone on your profile) are dropped, along with a separator like · next to them. Multi-line addresses keep their line breaks.",
          "**You** fields come from each sender's Profile: name, job title, email, phone, location, and mailing address. Each sender's own details are filled in, so one studio signature works for everyone.",
          "**Studio** fields come from **Settings** → **Business details**: studio name, legal name (the studio name if blank), email, phone, website, address, and tax ID.",
          "The switches **Add signatures to lead emails** and **Add signatures to Compose emails** apply to everyone's signature, including their own. They're also under **Where signatures are added** in **Settings** → **Email signature**. Anyone can see them; only owners and admins can change them.",
          "Turn off **Let people use their own signature** and everyone uses the studio signature. Their Profile then shows it without choices.",
          "**Remove** under the studio signature clears it, so emails go out without one unless people add their own. Changes to **Let people use their own signature** save as soon as you tick or untick it.",
        ],
      },
      { type: "h2", text: "Choose the address emails come from" },
      {
        type: "p",
        text: "Lead emails, **Email a new lead**, Compose, and document sends all go out through an SMTP mailbox. Worklane picks the first one that's set up:",
      },
      {
        type: "table",
        head: ["", "Used for", "Where to set it", "Replies go to"],
        rows: [
          ["1. Your own mailbox", "Lead emails only", "**CRM settings** → **Mailbox**", "That mailbox"],
          ["2. The studio's mailbox", "Everything", "**Settings** → **Sending email**", "The sender's own email"],
          ["3. Worklane's default", "Everything", "Set by whoever runs your Worklane server", "The sender's own email"],
        ],
      },
      { type: "h3", text: "Who can connect their own mailbox" },
      {
        type: "list",
        items: [
          "Owners and admins can always connect their own mailbox for lead emails.",
          "Members need it turned on: **Team** → **Access** on their row → **Own mailbox for lead emails**, then **Save access**. It needs Leads set to **Edit**. Until then, their lead emails go out from the studio's mailbox.",
          "Once it's on, owners and admins can also connect, test, edit, or remove that member's mailbox from the same **Edit access** panel, under **Lead email mailbox**.",
          "Turning the permission off keeps the saved mailbox but stops using it. The member can still remove it themselves.",
        ],
      },
      {
        type: "steps",
        items: [
          {
            title: "Click Connect SMTP",
            body: "In **CRM settings** → **Mailbox** for your own lead emails, or in **Settings** → **Sending email** for the whole studio.",
          },
          {
            title: "Pick your provider",
            body: "**Gmail / Google Workspace**, **Outlook / Microsoft 365**, **Zoho Mail**, and **SendGrid** fill in the server, port, and security for you. Choose **Other** for anything else.",
          },
          {
            title: "Enter the username and password",
            body: "For Gmail and Zoho with two-step sign-in, use an app password, not your normal one. The password is stored encrypted and never shown again.",
          },
          { title: "Set the From address and name", body: "The address is usually the same as the username." },
          {
            title: "Click Save and connect",
            body: "Worklane signs in once to check the details. If it can't, nothing is saved and you'll see why.",
          },
        ],
      },
      {
        type: "list",
        items: [
          "**Send test email** sends a short email to you through that saved mailbox.",
          "To change a mailbox, click **Edit**. Leave the password blank to keep the saved one.",
          "**Remove** disconnects it; emails then fall back to the next one in the list.",
          "Emails sent through SMTP don't appear in that mailbox's Sent folder unless your provider copies them there (Gmail does).",
        ],
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
            body: "The pixel is now on your clipboard. To make sure it copied as an image, paste it into the **Paste here to check it** box. For steps for your mail app, click **How to paste in Gmail, Outlook, or Apple Mail**.",
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
          { title: "If nothing is inserted, click Copy link only", body: "In Worklane, under **How to paste…** on the pixel dialog, or on the email's panel." },
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
          "You're notified the first time an email is opened, under **Tracked emails**. These alerts appear in Worklane only; they aren't sent by email.",
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
