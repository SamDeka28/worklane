import type { DocArticle } from "../types";

export const DELIVER: DocArticle[] = [
  {
    slug: "projects",
    title: "Create and run projects",
    summary:
      "Open a project for a client, choose how it bills, and use its tabs to plan, deliver, and get paid.",
    category: "deliver",
    kind: "guide",
    related: ["milestones", "tasks-and-boards", "billing-basics", "project-teams"],
    blocks: [
      {
        type: "p",
        text: "A project is one engagement for one client. It holds milestones, tasks, hours, documents, credentials, and — for people with Finance access — the money: charges, what's owed, and how net revenue splits between partners.",
      },
      { type: "h2", text: "Create a project" },
      {
        type: "steps",
        items: [
          { title: "Click New project", body: "Available once you have at least one client." },
          { title: "Pick the client and name it", body: "For example “Website rebuild” or “Q3 retainer”." },
          {
            title: "Set status and billing",
            body: "**Status** defaults to Active. **Billing** decides how charges get posted — see the table below.",
          },
          {
            title: "Platform fee and partner earnings",
            body: "**Platform fee** is taken off gross before anything is shared: None (0%), 4%, 5% Upwork, or 13%. **Partner earn on** decides whether partners earn **When charged** or **When collected**.",
          },
          { title: "Dates and scope", body: "Add **Contracted amount**, **Starts**, **Due**, and internal **Scope** notes." },
          {
            title: "Attach documents (optional)",
            body: "Tick existing proposals or SOWs from Docs, or upload PDFs, Word files, or images.",
          },
          { title: "Click Create project", body: "You become the project lead. The board starts with To do, Doing, and Done." },
        ],
      },
      { type: "h2", text: "Billing modes" },
      {
        type: "table",
        head: ["Mode", "Shown as", "How charges are posted"],
        rows: [
          ["Milestones", "Milestones", "You charge each milestone when it's due."],
          ["Hourly (logs post charges)", "Hourly", "Every work log posts a charge for hours × rate or a fixed amount."],
          ["Single contracted charge", "Contracted", "One charge for the contracted amount via **Post contracted charge**."],
          ["Manual", "Manual", "Charge milestones or the contracted amount by hand when you choose."],
          ["None (track only)", "Track only", "No charges — pure delivery tracking."],
        ],
      },
      { type: "h2", text: "Project statuses" },
      {
        type: "p",
        text: "**Planning**, **Active**, **On hold**, **Completed**, and **Cancelled**. Planning, Active, and On hold projects appear on Studio Board. In the Projects **Board** view you can drag a project between status columns to change it.",
      },
      { type: "h2", text: "The project page" },
      {
        type: "p",
        text: "The header shows status, client, billing mode, due date, and (with Finance access) the total. A **next step** card suggests exactly one action — **Add milestone**, **Log work**, **Review milestones**, **Collect**, or **Open board**.",
      },
      {
        type: "table",
        head: ["Tab", "What it's for"],
        rows: [
          ["Overview", "Snapshot of tasks, what's ready to bill, what's owed, docs, and milestone progress."],
          ["Milestones", "Phases with amounts, delivery status, and deliverables. See [Milestones](/docs/milestones)."],
          ["Work", "The task board and, on hourly projects, the work log. See [Tasks](/docs/tasks-and-boards) and [Log work](/docs/log-work)."],
          ["Charges", "Every charge on the project and a form to record payments. Finance access only."],
          ["Split", "Partner economics, the project team, and split versions. Finance access only."],
          ["Documents", "Linked proposals, SOWs, and uploaded files."],
          ["Credentials", "An encrypted vault for logins and keys. See [Credential vault](/docs/credentials)."],
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Each tab can be hidden per person from **Team → Access → Project tabs**. If someone opens a tab they can't use, they're sent to their first allowed tab.",
      },
      { type: "h2", text: "Project settings and deletion" },
      {
        type: "p",
        text: "Use **… → Project settings** to change name, status, billing, fee, partner earnings, contracted amount, dates, and scope. **Delete project** removes milestones, tasks, work logs, comments, and the split; charges, invoices, and documents are kept but unlinked. Deletion is blocked once partner payouts exist — set the project to Completed or Cancelled instead.",
      },
    ],
  },
  {
    slug: "milestones",
    title: "Plan milestones and deliverables",
    summary:
      "Break a project into phases with amounts and due dates, list deliverables, and turn them into board tasks.",
    category: "deliver",
    kind: "how-to",
    related: ["projects", "tasks-and-boards", "charges"],
    blocks: [
      {
        type: "p",
        text: "Milestones track two things separately: **delivery status** (is the work done?) and **billing** (has it been charged and paid?). That way a milestone can be finished but not yet billed — and Home will remind you.",
      },
      { type: "h2", text: "Add a milestone" },
      {
        type: "steps",
        items: [
          { title: "Open the project's Milestones tab", body: "Click **Add milestone**." },
          { title: "Name it", body: "For example “Kickoff”, “Design”, or “Launch”." },
          { title: "Delivery status", body: "**Planned**, **In progress**, **Done**, or **Cancelled**." },
          { title: "Amount and due date", body: "The amount is what you'll charge later. It's optional for track-only projects." },
          { title: "Description", body: "Scope notes. You'll add concrete deliverables after saving." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "The project's contracted amount always equals the sum of its non-cancelled milestone amounts, so the project total stays accurate as you add phases.",
      },
      { type: "h2", text: "Deliverables become tasks" },
      {
        type: "steps",
        items: [
          { title: "Click the pencil on a milestone", body: "The **Edit M1** sheet opens." },
          { title: "Add deliverables", body: "Type an item such as “Content hierarchy map” and press Enter." },
          { title: "Click Task on a deliverable", body: "A card is created in the **To do** list, tagged with the milestone. The row then shows **On board**." },
        ],
      },
      {
        type: "p",
        text: "You can also put the whole milestone on the board with **… → Add to board**. Each milestone row shows how many deliverables it has and how many are on the board.",
      },
      { type: "h2", text: "Billing badges" },
      {
        type: "table",
        head: ["Badge", "Meaning"],
        rows: [
          ["No charge", "Not billed yet."],
          ["Due", "Charged, waiting for payment."],
          ["Overdue", "Charged and past its due date."],
          ["Collected", "Paid in full."],
          ["Charge voided", "The charge was cancelled."],
        ],
      },
      {
        type: "p",
        text: "To bill a milestone, use **… → Charge**. After charging, the amount is locked so the books can't drift. Full steps in [Post charges](/docs/charges).",
      },
    ],
  },
  {
    slug: "tasks-and-boards",
    title: "Tasks and project boards",
    summary:
      "Create cards, assign teammates, set priority and due dates, comment, and customize each project's lists.",
    category: "deliver",
    kind: "how-to",
    related: ["studio-board", "milestones", "mentions", "project-teams"],
    blocks: [
      {
        type: "p",
        text: "Every project has its own kanban board on the **Work** tab. Cards move left to right as work progresses, and every open card also rolls up to [Studio Board](/docs/studio-board).",
      },
      { type: "h2", text: "Create a card" },
      {
        type: "steps",
        items: [
          { title: "Click Add a card", body: "At the bottom of any list." },
          { title: "Give it a title and description", body: "The description is rich text — type **@** to reference people, milestones, or other tasks." },
          {
            title: "Fill in details",
            body: "**Type** (Task, Bug, Feature, Chore), **Priority** (Low, Medium, High), **Assignees** (up to 8), **Milestone**, **Due**, and **Labels** (up to 12).",
          },
          { title: "Click Create card", body: "Newly assigned people are notified: “Sam assigned you a task”." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        title: "Can't find someone to assign?",
        text: "Assignees must be on the project team. Add them from **Split → Team** first — see [Project teams](/docs/project-teams).",
      },
      { type: "h2", text: "Work a card" },
      {
        type: "list",
        items: [
          "Hover a card to reveal its grip, then drag it to another list. A dashed placeholder shows where it will land.",
          "Click a card to open it. Add attachments (after the first save), change details, or **Remove card**.",
          "Comment at the bottom and press **⌘/Ctrl + Enter** to send. Assignees and earlier commenters are notified.",
          "Share a direct link to an open card — the URL includes the task.",
        ],
      },
      { type: "h2", text: "Reading a card" },
      {
        type: "p",
        text: "Cards show the type badge (except plain Task), milestone chip (for example “M2 · Wireframes”), priority as **L / M / H**, up to two labels, the due date (red when overdue), comment count, and up to three assignee avatars.",
      },
      { type: "h2", text: "Customize lists" },
      {
        type: "table",
        head: ["To…", "Do this"],
        rows: [
          ["Rename a list", "Click its name and type."],
          ["Reorder lists", "Drag a list by its handle."],
          ["Add a list", "Click **Add a list**, enter a name, and click **Add list**."],
          ["Delete a list", "**… → Delete column**. Its cards move to the first remaining list."],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "Custom lists count as “Doing” for status purposes, so you can add Review or QA columns without breaking Studio Board.",
      },
    ],
  },
  {
    slug: "studio-board",
    title: "Studio Board: every open card in one place",
    summary:
      "See work across all active projects, filter by client, assignee, or priority, and drag cards between status lanes.",
    category: "deliver",
    kind: "how-to",
    related: ["tasks-and-boards", "projects"],
    blocks: [
      {
        type: "p",
        text: "Studio Board rolls every card from projects that are **Planning**, **Active**, or **On hold** into one kanban, so nothing hides behind a project tab. Each card carries a project chip so you always know where it belongs.",
      },
      { type: "h2", text: "Filters" },
      {
        type: "table",
        head: ["Filter", "What it does"],
        rows: [
          ["Project", "**All projects (by status)** shows three lanes — To do, Doing, Done. Picking one project shows that project's own lists, which you can manage directly."],
          ["Client", "Only cards for one client's projects."],
          ["Assignee", "Click avatars to show one or more people's cards."],
          ["Priority", "**All**, **H**, **M**, or **L**."],
        ],
      },
      {
        type: "p",
        text: "Dragging a card between status lanes changes its status. You can also create cards here — pick the project in the card's details (it's locked after creation).",
      },
      {
        type: "callout",
        tone: "tip",
        text: "Standup view: filter by your avatar, set priority to **H**, and you have today's list.",
      },
    ],
  },
  {
    slug: "log-work",
    title: "Log hours on hourly projects",
    summary: "Record time or a fixed amount each day — every log posts a charge and allocates partner earnings.",
    category: "deliver",
    kind: "how-to",
    related: ["billing-basics", "partner-splits", "projects"],
    blocks: [
      {
        type: "p",
        text: "On projects billed **Hourly**, the Work tab has a **Log** view. One row replaces the timesheet spreadsheet: date, hours, rate, and what shipped.",
      },
      {
        type: "steps",
        items: [
          { title: "Open the project → Work → Log", body: "Or use the next-step button **Log work**, or ⌘K → “Log work”." },
          { title: "Date and hours", body: "Date defaults to today. Hours accept decimals — 1.5 or 1,5 both work." },
          { title: "Rate or fixed amount", body: "Rate is prefilled with your last rate. Enter a **Fixed** amount instead to bill a flat figure." },
          { title: "Milestone and notes", body: "Optionally tag a milestone, describe **What shipped**, and paste a Trello URL." },
          { title: "Check the preview and save", body: "The line “Posts ~$X net after fee” shows what will land. Click **Log and charge**." },
        ],
      },
      { type: "h2", text: "What happens when you log" },
      {
        type: "list",
        items: [
          "An open charge is posted to the client, dated on the work date, with gross, platform fee, and net.",
          "If the project splits earnings **When charged**, partners earn their share immediately.",
          "Each row shows **Charged** and hours × rate (or the fixed amount).",
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "A fixed amount overrides hours × rate. You need either hours and a rate, or a fixed amount.",
      },
    ],
  },
  {
    slug: "documents",
    title: "Write proposals and SOWs",
    summary:
      "Draft from an industry-standard template (proposal, SOW, MSA, NDA, brief, change order, status report), tag live project data with @, preview what the client sees, and link documents to work.",
    category: "deliver",
    kind: "how-to",
    related: ["document-editor", "sign-and-version", "client-review", "mentions"],
    blocks: [
      {
        type: "p",
        text: "Documents holds your proposals, statements of work, and other client-facing writing. Drafts are fully editable; once accepted or signed, a version is frozen permanently.",
      },
      { type: "h2", text: "Create a document" },
      {
        type: "steps",
        items: [
          { title: "Click New document", body: "From Documents, a client's Documents card, or a project's **New in Docs** button (which prefill the client and project)." },
          { title: "Title and kind", body: "**Proposal**, **SOW**, or **Other**." },
          { title: "Context", body: "Optionally link a **Client** and **Project**." },
          { title: "Click Create", body: "The editor opens with a starter template." },
        ],
      },
      { type: "h2", text: "The starter template" },
      {
        type: "p",
        text: "Every new document starts with a professional layout you can edit freely: a details table (Document, Client, Project, Status), then numbered sections — **Overview**, **Scope of work** (included and out of scope), **Delivery milestones**, **Investment** (or **Fees & payment** for SOWs), and **Next steps**.",
      },
      { type: "h2", text: "Live @ tags" },
      {
        type: "p",
        text: "Type **@** to tag a client, project, milestone, or task. In **Preview**, each tag expands into live details — a client shows its contact, a milestone its amount and due date — so your proposal always matches the project.",
      },
      {
        type: "callout",
        tone: "tip",
        title: "Create while you write",
        text: "If what you're tagging doesn't exist yet, the @ menu offers **Create client/project/milestone/task “…”**. Fill in the side sheet and click **Create & insert** — the new record is created and tagged in one step.",
      },
      { type: "h2", text: "Tables from project data" },
      {
        type: "p",
        text: "In the right-hand **Tags & structure** panel, **Insert milestones table** adds a Milestone / Amount / Due / Status table from the linked project, and **Insert tasks table** does the same for tasks. **Template library** opens a gallery of full templates; choosing one replaces the page and, if it belongs to another type, changes the document's type too. Highlighted fields are placeholders to fill in.",
      },
      { type: "h2", text: "Save and link" },
      {
        type: "p",
        text: "Click **Save** — you'll see “Draft saved: tags indexed”. A document tagged with a project appears on that project's Documents tab as **tagged in body**, **linked & tagged**, or **in Docs**.",
      },
      { type: "h2", text: "The documents list" },
      {
        type: "p",
        text: "The summary at the top counts documents **With clients** (sent, not yet signed), **Needs your signature** (the client signed and you still need to countersign), **Open comments**, and **Drafts**.",
      },
      {
        type: "table",
        head: ["Column", "Shows"],
        rows: [
          ["Document", "Title, kind, current version, client, and project."],
          ["Client activity", "Who it was sent to, whether by email or link only, how long ago, and whether they viewed the link or opened the email."],
          ["Review", "Open client comments, or “No open items”."],
          ["Signatures", "Whether the client and your side have signed: **Fully signed**, **Countersign needed**, or **Awaiting client**."],
          ["Status", "Draft, Sent, Accepted, Signed, or Void."],
        ],
      },
    ],
  },
  {
    slug: "document-editor",
    title: "Document editor reference",
    summary: "Every toolbar button, table control, keyboard shortcut, and formatting option in the document studio.",
    category: "deliver",
    kind: "reference",
    related: ["documents", "keyboard-shortcuts"],
    blocks: [
      { type: "h2", text: "Toolbar" },
      {
        type: "table",
        head: ["Group", "Controls"],
        rows: [
          ["History", "Undo, Redo"],
          ["Type", "Font (Default, Sans, Serif, Georgia, Times, Arial, Mono) and size 10–48px with A− / A+"],
          ["Headings", "H1, H2, H3"],
          ["Style", "Bold, Italic, Underline, Strikethrough, Text colour, Highlight"],
          ["Alignment", "Left, Center, Right, Justify"],
          ["Blocks", "Bullet list, Numbered list, Quote, Divider"],
          ["Insert", "Link, Table (8×8 grid picker), Attach file"],
        ],
      },
      { type: "h2", text: "Tables" },
      {
        type: "p",
        text: "Insert a table from the grid picker — it starts with a header row. With your cursor inside a table you get: add column after, add row after, delete column, delete row, delete table, and toggle header row.",
      },
      { type: "h2", text: "Images and files" },
      {
        type: "p",
        text: "**Attach file** inserts images inline and other files as a download link, up to 12 MB each. Content pasted from Word or Google Docs is cleaned up automatically.",
      },
      { type: "h2", text: "Selection menu and ruler" },
      {
        type: "p",
        text: "Select text for a floating menu with Bold, Italic, Underline, colour, highlight, and link. The ruler above the page lets you drag the left indent, first-line indent, and right indent like a word processor.",
      },
      { type: "h2", text: "Shortcuts" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "B"], label: "Bold" },
          { keys: ["⌘/Ctrl", "I"], label: "Italic" },
          { keys: ["⌘/Ctrl", "U"], label: "Underline" },
          { keys: ["⌘/Ctrl", "Z"], label: "Undo" },
          { keys: ["⌘/Ctrl", "⇧", "."], label: "Increase font size" },
          { keys: ["⌘/Ctrl", "⇧", ","], label: "Decrease font size" },
          { keys: ["Tab"], label: "Indent paragraph (or nest a list item)" },
          { keys: ["⇧", "Tab"], label: "Outdent" },
          { keys: ["@"], label: "Tag a person, client, project, milestone, or task" },
        ],
      },
      { type: "h2", text: "Edit and Preview" },
      {
        type: "p",
        text: "Toggle **Edit** / **Preview** in the top bar. Preview (“Client preview”) expands every @ tag into live data so you can read the document the way your client will.",
      },
    ],
  },
  {
    slug: "sign-and-version",
    title: "Send, sign, and version documents",
    summary:
      "Email a document from Worklane with open tracking, publish revisions to the same link, have both sides sign, and send the signed PDF and certificate.",
    category: "deliver",
    kind: "how-to",
    related: ["client-review", "documents", "projects"],
    blocks: [
      {
        type: "p",
        text: "Everything here lives in the **Share** panel on the right side of the editor. The client never needs an account: they review, comment, and sign from a private link.",
      },
      { type: "h2", text: "Document statuses" },
      {
        type: "table",
        head: ["Status", "Meaning"],
        rows: [
          ["Draft", "Editable."],
          ["Sent", "Emailed or published to the client. The sent version is kept as-is."],
          ["Accepted", "Frozen with **Mark as accepted**, without signatures."],
          ["Signed", "At least one side has signed. The version is locked."],
          ["Void", "No longer in effect."],
        ],
      },
      { type: "h2", text: "Send by email" },
      {
        type: "steps",
        items: [
          { title: "Click Send by email", body: "The email is sent from Worklane through your workspace's mail server; no mail app opens." },
          { title: "Recipient, CC, and subject", body: "Pick one of the client's contacts or type an address. Add up to five CC addresses." },
          { title: "Write the message", body: "A friendly default is filled in. When you've sent this document to them before, it says the document was revised and that the changes are highlighted." },
          { title: "Track opens (optional)", body: "Adds a tiny invisible image so you can see when the email was opened. Link views are always tracked." },
          { title: "Click Send", body: "The client gets a branded email with a **View** button. The version you sent is frozen, and the document moves to **Sent**." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Sending needs SMTP to be configured for the workspace (SMTP_USER and SMTP_PASS). Email opens are a hint, not proof: some mail apps block or pre-load images.",
      },
      { type: "h3", text: "Delivery log" },
      {
        type: "p",
        text: "Each send appears under the Share panel with its version and status chips: **Not opened yet**, **Opened** (the email), **Viewed** (the link), or **Published to link**. You get a notification the first time a client opens the email or views the link. **Copy link** gives you the client's link again; **Revoke** turns it off.",
      },
      { type: "h2", text: "Revise and publish" },
      {
        type: "steps",
        items: [
          { title: "Start a revision", body: "A sent version can't be edited. Click **Start revision v2** on the banner (or **Start a new version**) to copy it into an editable draft." },
          { title: "Address the feedback", body: "Edit the draft. The **Client review** card lists every comment and suggestion; mark each one addressed as you go." },
          { title: "Click Publish v2 to client", body: "Add a short **What changed?** note and choose whether to **Email them a short update**. Untick it for small fixes." },
        ],
      },
      {
        type: "p",
        text: "You never need to resend a new link. The client's existing link switches to the latest version, with changed sections available to highlight, and every earlier version stays viewable read-only. Comments and signing always apply to the latest version.",
      },
      { type: "h2", text: "Signing: both sides sign" },
      {
        type: "p",
        text: "Either side can sign first. The first signature locks the version, and the other side then signs the same locked copy, so both signatures cover exactly the same text.",
      },
      {
        type: "table",
        head: ["Situation", "What to do"],
        rows: [
          ["The client signed first", "A **Countersign** card appears. Your name and email are prefilled; type your signature, tick the consent box, and click **Countersign**. The client is emailed the fully signed copy."],
          ["You want to sign first", "Use **Record a signature**. The client's link then shows **Sign** and asks them to complete it."],
          ["No signatures needed", "**Mark as accepted** locks the version as the agreed copy."],
        ],
      },
      {
        type: "p",
        text: "Each signature records the name, email, typed signature, time, IP address, browser, and a SHA-256 fingerprint of the signed content. The signatures are shown under the document on both sides, with an **Awaiting signature** line for whoever hasn't signed yet.",
      },
      { type: "h2", text: "Signed copies and the certificate" },
      {
        type: "list",
        items: [
          "Signing emails attach a **PDF of the signed document**. Once both sides have signed, they also attach a separate **signature certificate** listing each signer, when and how they signed, and the fingerprint.",
          "The client gets a confirmation when they sign; you get a notification (with the PDF) and the document is ready to countersign.",
          "**Email signed copy** (in the Signed card) sends the PDFs to anyone, for example to resend them to the client or to your accountant. Only the client who owns the link gets a **View signed copy** button.",
          "**Download signed PDF** and **Download certificate** save the files directly.",
        ],
      },
      { type: "h2", text: "Turn a document into work" },
      {
        type: "list",
        items: [
          "**Create statement of work** (proposals only) creates “SOW · {title}” ready to fill in.",
          "**Create project** (once locked, when no project is linked) opens a Planning project on Milestones billing for the linked client.",
        ],
      },
    ],
  },
  {
    slug: "client-review",
    title: "Client review: comments, changes, and signing",
    summary:
      "What your client sees on their link, how they comment, suggest edits, request changes, and sign, and how you reply and mark feedback addressed.",
    category: "deliver",
    kind: "how-to",
    related: ["sign-and-version", "documents", "notifications"],
    blocks: [
      {
        type: "p",
        text: "When you send or publish a document, your client gets a private review page. It shows the document the way you designed it, a comments panel, and buttons to request changes or sign. No account or password is needed.",
      },
      { type: "h2", text: "What the client can do" },
      {
        type: "table",
        head: ["Action", "How"],
        rows: [
          ["Comment", "Type in the comments panel, or select text in the document and choose **Comment** to quote it."],
          ["Suggest an edit", "Select text and choose **Suggest edit**, then type the replacement. You see the original struck through and the suggestion beside it."],
          ["Request changes", "**Request changes** sends a summary of what needs to change. You're notified by email."],
          ["Accept & sign", "Type their full name and signature, tick the consent box, and sign. They're emailed a PDF of the signed copy."],
          ["Print", "**Print** produces a clean copy without the review panel."],
        ],
      },
      { type: "h2", text: "Revisions on the client's side" },
      {
        type: "list",
        items: [
          "Their link always opens the latest version you published. A banner says what changed, for example “Revised (v2): 3 sections changed since v1”.",
          "Changed sections aren't highlighted by default. **Highlight changes** turns the highlights on; **Hide highlights** turns them off.",
          "Small **v1 / v2** buttons next to the title open earlier versions read-only, with a link back to the latest.",
          "Once signed or accepted, the page shows who signed and becomes read-only.",
        ],
      },
      { type: "h2", text: "Handle feedback in the editor" },
      {
        type: "steps",
        items: [
          { title: "Open the Client review card", body: "It shows the number of open items. Each entry is tagged with the version it was left on." },
          { title: "Reply", body: "Type a reply. It appears on their page, and **Email the client** (on by default) also emails them a link." },
          { title: "Mark addressed", body: "Click **Mark addressed** once you've handled an item, or **Reopen** to bring it back. Addressed items fold into an **Addressed** section on both sides." },
          { title: "Publish the revision", body: "When you're ready, publish the new version to the same link. See Send, sign, and version documents." },
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "Opening the client's link yourself while signed in shows it as a preview: it isn't counted as a client view and you can't comment or sign as the client.",
      },
    ],
  },
  {
    slug: "files",
    title: "Files and attachments",
    summary: "Where you can attach files, which types are supported, and how previews and downloads work.",
    category: "deliver",
    kind: "reference",
    related: ["documents", "tasks-and-boards", "leads"],
    blocks: [
      {
        type: "table",
        head: ["Where", "How"],
        rows: [
          ["Leads", "Drop files in the lead sheet — proposals, briefs, screenshots."],
          ["Tasks", "**Add file** in the card (after the first save)."],
          ["Projects", "**Upload PDF** on the Documents tab, or when creating the project."],
          ["Documents", "**Attach file** in the editor — images inline, other files as links."],
        ],
      },
      { type: "h2", text: "Limits" },
      {
        type: "list",
        items: [
          "Up to **12 MB** per file.",
          "Supported: PNG, JPEG, WebP, GIF, PDF, TXT, DOC, and DOCX.",
        ],
      },
      { type: "h2", text: "Viewing files" },
      {
        type: "p",
        text: "PDFs, images, and text files preview inside Worklane. Word files open outside the app. Every viewer has **Download** and **Open in new tab**. Download links are private and expire after an hour — just reopen the file for a fresh one.",
      },
    ],
  },
  {
    slug: "credentials",
    title: "Store project credentials securely",
    summary:
      "Keep logins, API keys, and server access in an encrypted per-project vault, control who can see each one, and audit every reveal.",
    category: "deliver",
    kind: "how-to",
    related: ["security", "project-teams", "roles-and-access"],
    blocks: [
      {
        type: "p",
        text: "Stop hunting through spreadsheets and chat threads. Every project has a **Credentials** tab — an encrypted vault for the accounts that project depends on. You choose who can see each credential, and every reveal is logged.",
      },
      { type: "h2", text: "Add a credential" },
      {
        type: "steps",
        items: [
          { title: "Open the project → Credentials", body: "Click **Add credential**." },
          { title: "Name and type", body: "For example “Shopify admin”. Type: **Website login**, **API key**, **Database**, **Server / SSH**, **Email account**, or **Other**." },
          { title: "URL or host", body: "A web address or a host like db.example.com:5432." },
          {
            title: "Username and password",
            body: "Labels adapt to the type — **Key ID / client ID** and **Secret key** for API keys, **Password or private key** for servers. Use **Generate strong password** for a random 20-character password.",
          },
          { title: "Extra fields", body: "**+ Add field** for things like 2FA backup codes. Mark each **Hidden** or **Plain**." },
          { title: "Notes", body: "Recovery steps, account owner, renewal dates." },
          { title: "Choose who can see it", body: "See below, then click **Save credential**." },
        ],
      },
      { type: "h2", text: "Who can see a credential" },
      {
        type: "table",
        head: ["Option", "Who has access"],
        rows: [
          ["Everyone on this project", "The project team and assigned partners who can use the Credentials tab."],
          ["Only people I choose", "Just the teammates you tick — plus you, and owners and admins."],
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Owners and admins can always see every credential. Whoever adds a credential keeps access to it. Restricted credentials don't appear at all for anyone else.",
      },
      { type: "h2", text: "Reveal and copy" },
      {
        type: "list",
        items: [
          "Click **Reveal** to see the details. Passwords stay masked until you click the eye, and every value has a copy button.",
          "The revealed panel hides itself after **45 seconds**.",
          "The copy icon on the card copies the password without revealing it.",
        ],
      },
      { type: "h2", text: "Access history" },
      {
        type: "p",
        text: "From the card's **…** menu, **Access history** lists who added, edited, revealed, copied, re-shared, or deleted the credential, and when. Owners, admins, and whoever added the credential can see it.",
      },
      { type: "h2", text: "Permissions" },
      {
        type: "list",
        items: [
          "Anyone with edit access who can see a credential can update its details and secret.",
          "Only owners, admins, or the person who added it can change who can see it, view history, or delete it.",
          "Viewers and partners can reveal credentials shared with them but can't add or edit.",
          "Hide the whole tab for someone with **Team → Access → Project tabs → Credentials**. Partners don't get it unless you turn it on.",
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "Read [Security and privacy](/docs/security) for how the vault encrypts secrets.",
      },
    ],
  },
];
