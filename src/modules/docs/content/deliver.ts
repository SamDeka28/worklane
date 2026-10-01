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
            body: "**Status** defaults to Active. **Billing** defaults to **Hourly (logs post charges)** and decides how charges get posted — see the table below.",
          },
          {
            title: "Tax / deduction and partner earnings",
            body: "**Tax / deduction** comes off gross before anything is shared. The presets are None (0%), 4%, 5% Upwork (the default), and 13%. Choose **Custom percent** for any other rate, such as 10% TDS, or **Add a deduction** to save a named one for the studio. **Partner earn on** decides whether partners earn **When charged** or **When collected**.",
          },
          { title: "Dates and scope", body: "Add **Contracted amount**, **Starts**, **Due**, and internal **Scope** notes." },
          {
            title: "Attach documents (optional)",
            body: "Tick existing proposals or SOWs from Docs, or use **Upload files** to add PDFs, Word files, or images.",
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
          ["Hourly (logs post charges)", "Hourly", "Every work log posts a charge for hours × rate or a fixed amount. Set **Rate per hour** when you create the project or in **Project settings**; logs start from it."],
          ["Single contracted charge", "Contracted", "One charge for the contracted amount via **… → Post contracted charge**."],
          ["Monthly retainer", "Monthly", "Either a **fixed amount** each month, or **hourly**: log the month's hours, then **Post this month** bills them as one charge. A month can only be charged once. Tax and deductions come off first."],
          ["Manual", "Manual", "Charge milestones or the contracted amount by hand when you choose."],
          ["None (track only)", "Track only", "No charges — pure delivery tracking."],
        ],
      },
      { type: "h2", text: "Project statuses" },
      {
        type: "p",
        text: "**Planning**, **Active**, **On hold**, **Completed**, and **Cancelled**. Planning, Active, and On hold projects appear on Studio Board.",
      },
      { type: "h2", text: "The projects list" },
      {
        type: "p",
        text: "Switch between **List**, **Board**, and **Cards** views. Use **Search projects** and the status and client filters to narrow it down. The **Board** view has Planning, Active, On hold, and Completed columns (cancelled projects are hidden); drag a project to another column to change its status.",
      },
      { type: "h2", text: "The project page" },
      {
        type: "p",
        text: "The header shows status, client, billing mode, due date, and (with Finance access) the total or amount due. The **…** menu holds **Collect**, **Post contracted charge** (Contracted and Manual billing), and **Project settings**. A **next step** card suggests exactly one action — **Add milestone**, **Log work**, **Review milestones**, **Collect**, or **Open board**.",
      },
      {
        type: "table",
        head: ["Tab", "What it's for"],
        rows: [
          ["Overview", "Snapshot of tasks, what's ready to bill, what's owed, docs, and milestone progress, plus shortcuts to **Add partners** and **Set build pool**."],
          ["Milestones", "Phases with amounts, delivery status, and deliverables. See [Milestones](/docs/milestones)."],
          ["Work", "The task board and, on hourly projects, the work log. See [Tasks](/docs/tasks-and-boards) and [Log work](/docs/log-work)."],
          ["Charges", "Every charge on the project and a form to record payments. Finance access only."],
          ["Split", "Economics, partners, and access. Manage the project **Team** and **Partners**, and **Set split** or **Edit split**. Finance access only."],
          ["Documents", "Linked proposals, SOWs, and uploaded files. Use **Upload PDF**, **New in Docs**, or **Attach from Docs**."],
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
        text: "Use **… → Project settings** to change name, status, billing, fee, partner earnings, contracted amount, dates, and scope, then click **Save**. **Delete project** asks you to type the project name and needs delete permission. It removes milestones, tasks, work logs, comments, and the split; charges, invoices, and documents are kept but unlinked. Deletion is blocked once partner payouts exist — set the project to Completed or Cancelled instead.",
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
          { title: "Click Add milestone", body: "It appears as **M1**, **M2**, and so on. Change its delivery status any time from the select on its row." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Once milestones have amounts, the project's contracted amount is kept equal to the sum of its priced, non-cancelled milestones, so the project total stays accurate as you add phases.",
      },
      { type: "h2", text: "Deliverables become tasks" },
      {
        type: "steps",
        items: [
          { title: "Click a milestone row (or its pencil)", body: "The **Edit M1** sheet opens. Save changes with **Save M1**." },
          { title: "Add deliverables", body: "Type an item such as “Content hierarchy map” and press Enter or click **Add**." },
          { title: "Click Task on a deliverable", body: "A card is created in the **To do** list, tagged with the milestone. The row then shows **On board**; **Unlink** removes that card from the board." },
        ],
      },
      {
        type: "p",
        text: "You can also put the whole milestone on the board with **… → Add to board**, then use **Open on board** or **Remove from board** (which deletes the card). Each milestone row shows how many deliverables it has and how many are on the board.",
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
        text: "To bill a milestone, use **… → Charge**. It's available on Milestones and Manual billing once the milestone has an amount and isn't cancelled. Charging takes you to the Charges tab to record payment; afterwards the menu shows **Collect** or **View charge**. The amount is locked after charging so the books can't drift. Full steps in [Post charges](/docs/charges).",
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
        text: "Every project has its own kanban board on the **Work** tab. Cards move left to right as work progresses, and every card on a Planning, Active, or On hold project also rolls up to [Studio Board](/docs/studio-board).",
      },
      { type: "h2", text: "Create a card" },
      {
        type: "steps",
        items: [
          { title: "Click Add a card", body: "At the bottom of any list." },
          { title: "Give it a title and description", body: "The description is rich text — type **@** to reference people, milestones, or other tasks." },
          {
            title: "Fill in details",
            body: "**Type** (Task, Bug, Feature, Chore), **Priority** (L, M, H), **Assignees** (up to 8), **Milestone**, **Due**, and **Labels** (up to 12, each up to 24 characters — press Enter or comma to add one).",
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
          "Click a card to open it. Add attachments with **Add file** (after the first save), change details and click **Save card**, or **Remove card**.",
          "Click **Activity** in the card to see its history, and **Back to details** to return.",
          "Comment at the bottom and click **Comment** or press **⌘/Ctrl + Enter**. Assignees and earlier commenters are notified; anyone you @mention gets a mention notification instead.",
          "Use the **Copy link** button (in the card, or on hover on the board) to share a direct link to the card.",
        ],
      },
      { type: "h2", text: "Reading a card" },
      {
        type: "p",
        text: "Cards show the type badge (except plain Task), milestone chip (for example “M2 · Wireframes”), priority as **L / M / H**, up to two labels (then “+N”), the due date (red when overdue), comment count, and up to three assignee avatars.",
      },
      { type: "h2", text: "Customize lists" },
      {
        type: "table",
        head: ["To…", "Do this"],
        rows: [
          ["Rename a list", "Click its name and type."],
          ["Reorder lists", "Drag a list by its handle."],
          ["Add a list", "Click **Add a list**, enter a name, and click **Add list**."],
          ["Delete a list", "**… → Delete column** (only when there's more than one list). Its cards move to the first remaining list."],
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
    title: "Studio Board: every card in one place",
    summary:
      "See work across all active projects as a board or a list, filter by client, assignee, or priority, and move cards between status lanes.",
    category: "deliver",
    kind: "how-to",
    related: ["tasks-and-boards", "projects"],
    blocks: [
      {
        type: "p",
        text: "Studio Board rolls every card from projects that are **Planning**, **Active**, or **On hold** into one kanban, including cards already in Done, so nothing hides behind a project tab. Each card carries a project chip so you always know where it belongs.",
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
      { type: "h2", text: "Board and list views" },
      {
        type: "p",
        text: "Use the toggle at the right of the toolbar to switch between **Board** (kanban columns) and **List**. The list is one flat table of cards; each row's status is a badge you can click to move the card. Click a row to open the card, and **New card** to add one. Filters apply to both views, and the choice is kept in the URL (`?view=list`) so you can bookmark or share it.",
      },
      {
        type: "table",
        head: ["In list view", "What it does"],
        rows: [
          ["Column headers", "Click to sort by that column; click again to reverse, a third time to go back to board order. **Clear sort** resets it."],
          ["**Group**", "**No grouping** (default), or group rows by **Status**, **Project**, **Priority**, or **Assignee**. Click a group header to collapse it; **Add** on a status group creates a card there."],
          ["**Columns**", "Show or hide Project, Status, Assignee, Priority, Due, Milestone, Labels, and Comments."],
        ],
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
        text: "On projects billed **Hourly**, the Work tab has a **Log** view, and it opens there by default. Time comes in two ways: from the board's task clocks, or entered by hand. Both end up as the same log row: date, start and end, hours, rate, the task, and what shipped.",
      },
      { type: "h2", text: "Track time from the board" },
      {
        type: "steps",
        items: [
          { title: "Move a card to Doing", body: "Its clock starts, and a message confirms it. Moving it back and forth doesn't restart a clock that's already running." },
          { title: "Move it to Done (or any other column)", body: "The clock stops and **Log time** opens with **Started**, **Ended**, and the **Hours** worked out between them." },
          { title: "Adjust and log", body: "Change the start or end if the clock ran while you weren't working, or edit the hours directly. **Rate per hour** starts from the project's rate. Click **Log and charge**, or **Later** to keep the time for later." },
        ],
      },
      {
        type: "p",
        text: "The **Clocks** list at the top of the Log view shows every running clock with its elapsed time, and every stopped clock that hasn't been logged yet. Use **Stop** to end a running clock, **Log time** to log a stopped one, or **Discard** to drop it.",
      },
      { type: "h2", text: "Log time by hand" },
      {
        type: "steps",
        items: [
          { title: "Open the project → Work → Log", body: "Or use the next-step button **Log work**, or ⌘K → “Log work”." },
          { title: "Date, task, and times", body: "Date defaults to today. Pick a **Task** from the board (optional; its title fills **What shipped** if you leave that blank). Enter a start and end time and **Hours** fills in; an end before the start counts as past midnight. You can also skip the times and type hours, with up to three decimals." },
          { title: "Per hour or Fixed", body: "**Per hour** is the default: **Rate / hr** is prefilled with the project's **Rate per hour** (or the last rate logged if none is set), and you can change it for one log. Switch to **Fixed** for work the client agreed as a set fee, and enter the **Amount**; hours are optional there, for tracking." },
          { title: "Milestone and notes", body: "Optionally tag a milestone (shown once the project has milestones) and describe **What shipped**." },
          { title: "Check the preview and save", body: "The line “Posts ~$X net after fee” shows what will land. Click **Log and charge**." },
        ],
      },
      { type: "h2", text: "What happens when you log" },
      {
        type: "list",
        items: [
          "An open charge is posted to the client, dated on the work date, with gross, platform fee, and net.",
          "If the project splits earnings **When charged**, partners earn their share immediately.",
          "Each row shows **Charged** (or **No charge**), the start and end times, the task, and hours × rate (or the fixed amount).",
          "Logging a task's stopped clock clears it from **Clocks**.",
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "A fixed amount is charged as entered, whatever the hours. A per-hour log needs hours and a rate; leave the rate blank and the project's rate per hour is used.",
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
          { title: "Title and template", body: "Enter a **Title** and pick a **Template**. The template also sets the document's kind." },
          { title: "Context", body: "Optionally link a **Client** and **Project**." },
          { title: "Click Create", body: "The editor opens with the template filled in." },
        ],
      },
      { type: "h2", text: "Templates" },
      {
        type: "table",
        head: ["Template", "Kind"],
        rows: [
          ["Project proposal", "Proposal"],
          ["Statement of work", "Statement of work"],
          ["Master services agreement", "Services agreement"],
          ["Mutual NDA", "NDA"],
          ["Project brief", "Project brief"],
          ["Change order", "Change order"],
          ["Status report", "Status report"],
          ["Meeting notes, Blank document", "Document"],
        ],
      },
      {
        type: "p",
        text: "Each template gives you a professional layout you can edit freely: a cover, a details table, numbered sections, and a signature block. The linked client and project are filled in as @ tags; anything else is a highlighted placeholder to fill in.",
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
        text: "In the right-hand **Insert** card, **Milestones table** adds a Milestone / Amount / Due / Status table from the linked project, and **Tasks table** does the same for tasks. **Template library** opens a gallery of full templates; choosing one replaces the page and, if it belongs to another kind, changes the document's kind too. Change the client or project in the **Linked to** card (pick a client before a project).",
      },
      { type: "h2", text: "Save and link" },
      {
        type: "p",
        text: "Click **Save** or press **⌘/Ctrl + S** — you'll see “Draft saved: tags indexed”. A document tagged with a project appears on that project's Documents tab as **tagged in body**, **linked & tagged**, or **in Docs**.",
      },
      { type: "h2", text: "The documents list" },
      {
        type: "p",
        text: "Filter by kind with the chips at the top. The summary counts documents **With clients** (sent, not yet signed), **Needs your signature** (the client signed and you still need to countersign), **Open comments**, and **Drafts**.",
      },
      {
        type: "table",
        head: ["Column", "Shows"],
        rows: [
          ["Document", "Title, kind, current version, client, and project."],
          ["Client activity", "Who it was sent to and whether they viewed the link or opened the email — for example “Viewed 2h ago”, “Not opened yet”, or “Not shared yet”."],
          ["Review", "The number of open client comments, or “—”."],
          ["Signatures", "**Countersign needed**, **Awaiting client**, **No signatures** (accepted without signing), or a check for each side that has signed (Client, You)."],
          ["Status", "Draft, Sent, Accepted, Signed, or Void."],
          ["Updated", "When the document last changed."],
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
          ["Type", "**Font** (Default, Sans, Serif, Georgia, Times, Arial, Mono) and **Font size** 10–48 with A− / A+"],
          ["Paragraph style", "Normal text, Heading 1, Heading 2, Heading 3"],
          ["Style", "Bold, Italic, Underline, Strikethrough, Text color, Highlight"],
          ["Alignment", "Left, Center, Right, Justify, and **Line spacing** (Auto, 1, 1.15, 1.5, 2)"],
          ["Blocks", "Bullet list, Ordered list, Checklist, Decrease / Increase indent, Quote, Divider, Clear formatting"],
          ["Insert", "Link, Table (8×8 grid picker), Attach file"],
        ],
      },
      { type: "h2", text: "Tables" },
      {
        type: "p",
        text: "Insert a table from the grid picker — it starts with a header row. With your cursor inside a table the toolbar adds: add column after, add row after, delete column, delete row, delete table, and toggle header row.",
      },
      { type: "h2", text: "Right-click menu" },
      {
        type: "p",
        text: "Right-click in the page for **Cut**, **Copy**, **Paste**, **Paste without formatting**, **Delete**, links, **Format text**, **Paragraph style**, **Lists**, and **Insert** (a 3 × 3 table or a horizontal line). Inside a table it adds **Table options**: insert rows above or below, insert columns left or right, and **More table options** to merge or unmerge cells, toggle the header row, or delete. **Select all** and **Clear formatting** are at the bottom.",
      },
      { type: "h2", text: "Pages" },
      {
        type: "p",
        text: "The document is laid out as real pages, numbered in the footer. The bar under the page shows the page and word count, a **Page size** picker (A4, Letter, or Legal), and **Full screen** for distraction-free writing (press Esc to exit).",
      },
      { type: "h2", text: "Images and files" },
      {
        type: "p",
        text: "**Attach file** inserts images inline and other files as a download link, up to 12 MB each. Content pasted from Word or Google Docs is cleaned up automatically.",
      },
      { type: "h2", text: "Selection menu and ruler" },
      {
        type: "p",
        text: "Select text for a floating menu with Bold, Italic, Underline, colour, highlight, and link. The ruler above the page lets you drag the page margins and the left, first-line, and right indents like a word processor.",
      },
      { type: "h2", text: "Shortcuts" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "S"], label: "Save draft" },
          { keys: ["⌘/Ctrl", "⇧", "F"], label: "Full screen (Esc to exit)" },
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
        text: "Toggle **Edit** / **Preview** in the top bar. Preview (“Showing what the client sees”) expands every @ tag into live data so you can read the document the way your client will. Once a document has more than one version, **v1 / v2** buttons in the top bar switch between them.",
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
          { title: "Click Send by email", body: "The email is sent from Worklane through your workspace's mail server; no mail app opens. Replies go to you." },
          { title: "To, CC, and Subject", body: "Pick one of the client's contacts or type an address. Add up to five **CC** addresses, separated by commas." },
          { title: "Write the message", body: "A friendly default is filled in. When you've sent this document to them before, it says the document was revised and that the changes are highlighted." },
          { title: "Track opens", body: "On by default. Adds a tiny invisible image so you can see when the email was opened. Link views are always tracked." },
          { title: "Click Send email", body: "The client gets a branded email with a button such as **View proposal**. The version you sent is frozen, and the document moves to **Sent**." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Documents go out from the studio's mailbox set in Settings, otherwise Worklane's default address. Replies go to you. See [Choose the address emails come from](/docs/email-tracking). Email opens are a hint, not proof: some mail apps block or pre-load images.",
      },
      { type: "h3", text: "Delivery log" },
      {
        type: "p",
        text: "Each send appears under the Share panel with its version, recipient, and status chips: **Not opened yet**, **Opened** (the email), **Viewed** (the link), **Delivered** (sent without open tracking), **Published to link**, or **Link revoked**. You get a notification the first time a client views the link. On a send, **Copy link** gives you the client's link again; **Revoke** turns it off.",
      },
      {
        type: "callout",
        tone: "note",
        text: "The **Copy link** button at the top of the Share card copies an internal link for teammates with access to this workspace, not the client's link.",
      },
      { type: "h2", text: "Revise and publish" },
      {
        type: "steps",
        items: [
          { title: "Start a revision", body: "A sent version can't be edited. Click **Start revision v2** on the banner (or **Start a new version**) to copy it into an editable draft." },
          { title: "Address the feedback", body: "Edit the draft. The **Client review** card lists every comment and suggestion; mark each one addressed as you go." },
          { title: "Click Publish v2 to client", body: "Add a short **What changed?** note and choose whether to **Email them a short update**. Untick it for small fixes; the link updates without an email." },
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
          ["The client signed first", "A **Countersign** card appears. Your name and email are prefilled; fill in **Type your signature**, tick the consent box, and click **Countersign**. The client is emailed the fully signed copy, and you're copied."],
          ["You want to sign first", "Use **Record a signature**: enter **Full name** and **Email**, then click **Sign document**. No email is sent; the client's link then shows **Sign** and asks them to complete it."],
          ["No signatures needed", "**Mark as accepted** locks the version as the agreed copy."],
        ],
      },
      {
        type: "p",
        text: "Client signatures and countersignatures record the name, email, typed signature, time, IP address, browser, and a SHA-256 fingerprint of the signed content. **Record a signature** keeps only the name, email, time, and browser. The signatures are shown under the document on both sides, with an **Awaiting signature** line for whoever hasn't signed yet.",
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
          "**Create project** (once locked, when a client but no project is linked) opens a Planning project on Milestones billing with a 5% platform fee.",
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
          ["Comment", "Type in the comments panel and click **Send comment**, or select text in the document and choose **Comment** to quote it."],
          ["Suggest an edit", "Select text and choose **Suggest edit**, type the replacement (and an optional reason), then click **Send suggestion**. You see the original struck through and the suggestion beside it."],
          ["Request changes", "**Request changes** → describe what needs to change → **Send request**. You're always notified by email."],
          ["Accept & sign", "**Accept & sign** (or **Sign** if you've already signed) → **Full legal name**, **Signature**, tick the consent box, and click **Sign document**. They're emailed a PDF of the signed copy."],
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
          "A status pill shows where things stand, for example **In review**, **Awaiting your signature**, or **Fully signed**.",
          "If a newer revision was sent to someone else, their link says so and they can only comment.",
          "Once signed or accepted, the page shows who signed and becomes read-only.",
        ],
      },
      { type: "h2", text: "Handle feedback in the editor" },
      {
        type: "steps",
        items: [
          { title: "Open the Client review card", body: "It shows the number of open items. Each entry is tagged with the version it was left on." },
          { title: "Reply", body: "Type in “Reply to the client…” and click **Reply**. It appears on their page, and **Email the client** (on by default) also emails them a link. With several recipients, choose who to send it to." },
          { title: "Mark addressed", body: "Click **Mark addressed** once you've handled an item, or **Reopen** to bring it back. Addressed items fold into an **Addressed** section on both sides." },
          { title: "Publish the revision", body: "When you're ready, publish the new version to the same link. See [Send, sign, and version documents](/docs/sign-and-version)." },
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
          ["Projects", "**Upload PDF** on the Documents tab, or drag files anywhere onto the tab's list. You can also use **Upload files** when creating the project."],
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
            body: "Labels adapt to the type — **Key ID / client ID** and **Secret key** for API keys, **User** for databases, **Password or private key** for servers. Use **Generate strong password** for a random 20-character password.",
          },
          { title: "Extra fields", body: "**Add field** for things like 2FA backup codes. Mark each **Hidden** or **Plain**." },
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
          "**… → Edit** opens the credential with its secret shown, so opening it is logged as a reveal. Click **Save changes** when done.",
          "Use **Search credentials** to filter by name, URL, or type.",
        ],
      },
      { type: "h2", text: "Access history" },
      {
        type: "p",
        text: "From the card's **…** menu, **Access history** lists who added, edited, revealed, copied, or deleted the credential, or changed who can see it, and when. Owners, admins, and whoever added the credential can see it.",
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
