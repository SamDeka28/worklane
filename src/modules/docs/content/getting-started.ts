import type { DocArticle } from "../types";

export const GETTING_STARTED: DocArticle[] = [
  {
    slug: "introduction",
    title: "What is Worklane?",
    summary:
      "The studio operating system: sell the work, deliver it, and collect on it — on one continuous record.",
    category: "getting-started",
    kind: "guide",
    related: ["quick-start", "navigating-worklane", "roles-and-access"],
    blocks: [
      {
        type: "p",
        text: "Worklane is built for studios and small teams that sell creative or software work, deliver it with collaborators, and need the money trail to stay attached to the work. Instead of a CRM, a project board, and a spreadsheet that drift apart, everything lives on one record that moves forward as the work does.",
      },
      { type: "h2", text: "The lane" },
      {
        type: "p",
        text: "Every engagement travels the same four stages. You never retype a company, contact, or deal value between them.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Lead",
            body: "A conversation becomes an opportunity on your lead journey. Drag it through stages you define — Discovery, Proposal, whatever your studio uses.",
          },
          {
            title: "Client",
            body: "When you win, **Become a client** creates the client, its primary contact, and a starter project straight from the lead.",
          },
          {
            title: "Project & Board",
            body: "Delivery lives on the project — milestones, tasks, work logs, documents, and credentials. Studio Board rolls every open card into one kanban.",
          },
          {
            title: "Money",
            body: "Charge milestones or hours, record what the client pays, and share net revenue with partners — all on the same books as the work.",
          },
        ],
      },
      { type: "h2", text: "Modules at a glance" },
      {
        type: "table",
        head: ["Module", "What it's for"],
        rows: [
          ["Home", "Studio health: what's owed, what to bill next, pipeline, and a single **Do next** action."],
          ["Leads", "Your sales pipeline as a board or a list, with customizable stages."],
          ["Clients", "Who you work with and bill: contacts, projects, documents, and the ledger."],
          ["Projects", "Delivery: milestones, tasks, hours, documents, split, and a credential vault."],
          ["Board", "Studio Board — every open card across active projects in one kanban."],
          ["Documents", "Proposals and SOWs with live @ tags, versions, and click-to-sign."],
          ["Finance", "Charges, payments, what's ready to bill, and a month-end wrap."],
          ["Partners", "Collaborator earnings from project splits, balances, and payouts."],
          ["Team", "Invite people and choose exactly what each person can see."],
        ],
      },
      { type: "h2", text: "Who sees what" },
      {
        type: "p",
        text: "Access is set per person. A teammate on the **Progress** preset can run projects and docs without ever seeing charges, outstanding balances, or pipeline dollars. Partners get read-only delivery access plus their own earnings. Owners and admins see everything. See [Roles and access](/docs/roles-and-access) for the full matrix.",
      },
      {
        type: "callout",
        tone: "tip",
        title: "New here?",
        text: "Follow the [Quick start](/docs/quick-start) — it takes you from an empty studio to your first collected payment in about ten minutes.",
      },
    ],
  },
  {
    slug: "quick-start",
    title: "Quick start: your first ten minutes",
    summary:
      "Create your studio, add a client, open a project, invite your team, and record your first payment.",
    category: "getting-started",
    kind: "guide",
    related: ["introduction", "invite-teammates", "billing-basics"],
    blocks: [
      {
        type: "p",
        text: "This walkthrough takes a brand-new studio all the way around the lane. Each step links to a deeper guide if you want the details.",
      },
      { type: "h2", text: "1. Create your account and studio" },
      {
        type: "steps",
        items: [
          {
            title: "Go to Sign up",
            body: "Open [/signup](/signup) and enter your **Studio name** (optional), **Email**, and a **Password** of at least 8 characters — or use **Google**.",
          },
          {
            title: "Confirm your email if asked",
            body: "Some deployments require confirmation. If you see “Check your email to confirm this account”, click the link in that email, then sign in.",
          },
          {
            title: "Take the welcome tour",
            body: "Your studio opens with a three-step tour — **Welcome**, **How Worklane moves**, and **Your access**. You can **Skip** it at any time.",
          },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "You become the studio **Owner**. Leads, Documents, Projects, Finance, and Partners are switched on from the start.",
      },
      { type: "h2", text: "2. Add your first lead or client" },
      {
        type: "p",
        text: "If the work is still being sold, start with a lead: **Leads → New lead**, fill in the name, company, and estimated value, then click **Create lead**. When you win it, open the lead and click **Become a client** — Worklane creates the client, contact, and a project for you. See [Win a lead and convert it](/docs/convert-a-lead).",
      },
      {
        type: "p",
        text: "If the work is already signed, go straight to **Clients → New client**, choose **Company** or **Person**, pick a **Currency** (USD or INR), and add a primary contact.",
      },
      { type: "h2", text: "3. Open a project" },
      {
        type: "steps",
        items: [
          { title: "Go to Projects → New project", body: "The button is enabled once you have at least one client." },
          {
            title: "Choose a billing mode",
            body: "Pick **Milestones** for fixed-price phases, **Hourly (logs post charges)** for time-and-materials, or **Single contracted charge** for one flat fee. See [How billing works](/docs/billing-basics).",
          },
          { title: "Set dates and the platform fee", body: "Add **Starts** and **Due** dates and pick a **Platform fee** if the work comes through a marketplace." },
          { title: "Click Create project", body: "You're added as the project lead, and the task board starts with **To do**, **Doing**, and **Done**." },
        ],
      },
      { type: "h2", text: "4. Invite your team" },
      {
        type: "p",
        text: "Go to **Team**, enter a teammate's email, pick a **Studio role**, choose the projects they should join, and pick an access preset — **Full**, **Progress**, **Partner**, or **Custom**. Click **Send invite**. Details in [Invite teammates](/docs/invite-teammates).",
      },
      { type: "h2", text: "5. Plan and deliver" },
      {
        type: "list",
        items: [
          "Add milestones on the project's **Milestones** tab — each can carry an amount for billing later. See [Milestones](/docs/milestones).",
          "Turn milestone deliverables into board tasks, assign them, and drag them across the board. See [Tasks and project boards](/docs/tasks-and-boards).",
          "On hourly projects, use **Log work** each day — every log posts a charge automatically. See [Log work](/docs/log-work).",
        ],
      },
      { type: "h2", text: "6. Bill and collect" },
      {
        type: "steps",
        items: [
          { title: "Charge a milestone", body: "On the milestone's **…** menu choose **Charge**. You'll see “Charge posted: collect when paid”." },
          { title: "Record the payment", body: "When the client pays, go to **Finance → Collect**, pick the client, enter the amount and method, and click **Record**." },
          { title: "Share with partners", body: "If partners worked on it, their share of net is posted automatically. Pay them from **Partners → Settle**." },
        ],
      },
      {
        type: "callout",
        tone: "tip",
        title: "Let Home tell you what's next",
        text: "The **Do next** card on Home always shows the single most urgent action — collect an overdue charge, bill a finished milestone, log today's work, or settle a partner.",
      },
    ],
  },
  {
    slug: "navigating-worklane",
    title: "Find your way around",
    summary:
      "The sidebar, header, Create menu, command palette, and notifications — and how they adapt to your access.",
    category: "getting-started",
    kind: "reference",
    related: ["keyboard-shortcuts", "studios", "notifications"],
    blocks: [
      { type: "h2", text: "Sidebar" },
      {
        type: "p",
        text: "The sidebar is grouped the way work flows: **Home**, then **Sell** (Leads, Clients), **Deliver** (Projects, Board, Documents, Team), and **Money** (Finance, Partners).",
      },
      {
        type: "list",
        items: [
          "Home, Clients, and Team are always visible.",
          "Other items appear only when the module is on for your studio and your access to it isn't **Off**. Board follows your Projects access.",
          "On wide screens you see icons and labels; on medium screens an icon strip (hover for names); on phones it opens from the menu button in the header.",
        ],
      },
      {
        type: "p",
        text: "At the top of the sidebar, click your studio name to switch studios or **Add organization**. At the bottom, your account menu has **Profile**, **Appearance**, **Studio settings**, **Help & docs**, and **Sign out**.",
      },
      { type: "h2", text: "Header" },
      {
        type: "table",
        head: ["Control", "What it does"],
        rows: [
          ["Page title", "Shows where you are — Home is titled **Overview**."],
          ["Search (⌘K)", "Opens the command palette to jump anywhere or create something."],
          ["Bell", "Your notifications, with an unread badge and live updates."],
          ["+ Create", "Quick create: New lead, New client, New project, New charge, Collect, New document. Hidden for read-only roles."],
          ["Avatar", "The same account menu as the sidebar."],
        ],
      },
      { type: "h2", text: "Command palette" },
      {
        type: "p",
        text: "Press **⌘K** on Mac or **Ctrl+K** on Windows and Linux. Type to filter, use the arrow keys, and press Enter. Items you don't have access to never appear.",
      },
      {
        type: "table",
        head: ["Group", "Items"],
        rows: [
          ["Go", "Home, Leads, Clients, Projects, Documents, Finance, Partners, Team, Settings, Appearance"],
          ["Sell", "New lead, New client, New document"],
          ["Deliver", "New project, Log work, Invite teammate"],
          ["Money", "Collect, New charge, Invoices"],
          ["Account", "Help & documentation, Sign out"],
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "“New …” items open the create sheet directly, so ⌘K → “new lead” → Enter is the fastest way to capture a deal mid-call.",
      },
      { type: "h2", text: "Toasts and next steps" },
      {
        type: "p",
        text: "Every action confirms itself with a short message at the bottom of the screen. Most pages also show a **next step** card — the one action that moves that record forward, such as **Add milestone**, **Log work**, or **Collect**.",
      },
    ],
  },
  {
    slug: "studios",
    title: "Create and switch studios",
    summary:
      "Belong to more than one studio, add a new one you own, and jump between them without losing your place.",
    category: "getting-started",
    kind: "how-to",
    related: ["navigating-worklane", "invite-teammates"],
    blocks: [
      {
        type: "p",
        text: "A studio (also called an organization) is a separate workspace with its own clients, projects, books, and team. You can belong to several — for example your own studio and a partner's.",
      },
      { type: "h2", text: "Add a studio" },
      {
        type: "steps",
        items: [
          { title: "Open the studio switcher", body: "Click the studio name and logo at the top of the sidebar." },
          { title: "Choose Add organization", body: "Enter an **Organization name** (up to 80 characters)." },
          { title: "Click Create", body: "You become the owner and land on the new studio's home, ready to invite people." },
        ],
      },
      { type: "h2", text: "Switch studios" },
      {
        type: "p",
        text: "Open the switcher and pick a studio. Worklane keeps you in the same section when it exists — switching while on Projects lands you on the other studio's Projects. Your last studio is remembered and opened the next time you sign in.",
      },
      {
        type: "callout",
        tone: "note",
        text: "Your profile, theme, and notification email preferences are personal and follow you across every studio. Access and roles are set separately in each studio.",
      },
    ],
  },
];
