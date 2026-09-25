import type { DocArticle } from "../types";

export const TEAM: DocArticle[] = [
  {
    slug: "invite-teammates",
    title: "Invite teammates",
    summary:
      "Send an invite with the right role, projects, and access — then resend, revoke, or remove people later.",
    category: "team",
    kind: "how-to",
    related: ["roles-and-access", "project-teams", "partners"],
    blocks: [
      { type: "h2", text: "Send an invite" },
      {
        type: "steps",
        items: [
          { title: "Go to Team", body: "Or ⌘K → “Invite teammate”." },
          { title: "Email", body: "The address they'll sign in with." },
          { title: "Studio role", body: "**Admin** (owners and admins only), **Member**, **Viewer**, or **Partner**." },
          {
            title: "Add to projects (optional)",
            body: "Pick projects from the menu and a **Project role** — Member or Lead. Leave it on **Studio only** for studio-wide access with no projects yet.",
          },
          { title: "Access", body: "Choose **Full**, **Progress**, **Partner**, or **Custom**. See [Roles and access](/docs/roles-and-access)." },
          { title: "Manage team (Members only)", body: "Lets them invite people and change access, up to their own level." },
          { title: "Click Send invite", body: "They get an email with **Accept invitation**. If email isn't configured, the invite link is copied for you to share." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Invites expire after **14 days**. Inviting someone who's already in the studio with projects selected simply adds them to those projects.",
      },
      { type: "h2", text: "What your teammate sees" },
      {
        type: "list",
        items: [
          "Signed out: **Create account & accept** or **Sign in & accept**. The email is locked to the invited address and no extra studio is created.",
          "Signed in: access is set up automatically and they land on their first project with a welcome tour.",
          "Signed up with Google without the link? Pending invites for that email are still claimed on first sign-in.",
          "You're notified when they join: “{Name} joined {Studio}”.",
        ],
      },
      { type: "h2", text: "Pending invites" },
      {
        type: "p",
        text: "The **Pending invites** card shows each invite as Pending or Expired. **Resend** creates a fresh link and resets the 14 days (old links stop working). **Revoke** invalidates the link.",
      },
      { type: "h2", text: "Change access or remove someone" },
      {
        type: "steps",
        items: [
          { title: "Click Access on their row", body: "The **Edit access** panel opens." },
          { title: "Change role, projects, or access", body: "Then click **Save access**. They're notified of the change." },
          {
            title: "To remove them",
            body: "Scroll to **Remove from studio**, click **Remove member**, and type their email to confirm. Their tasks, logs, and comments are kept.",
          },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "The owner's access can't be changed, you can't change your own access, and only owners can change or remove admins.",
      },
    ],
  },
  {
    slug: "roles-and-access",
    title: "Roles and access",
    summary:
      "What owners, admins, members, viewers, and partners can do, how presets work, and how to fine-tune modules and project tabs.",
    category: "team",
    kind: "reference",
    related: ["invite-teammates", "project-teams", "credentials"],
    blocks: [
      { type: "h2", text: "Studio roles" },
      {
        type: "table",
        head: ["Role", "What they can do"],
        rows: [
          ["Owner", "Created the studio. Full access to everything; can't be edited or removed. Gets copies of most studio notifications."],
          ["Admin", "Full access, manages the team, can always delete. Only owners can promote, edit, or remove admins."],
          ["Member", "Edits where their module access is **Edit**. Deletes only where the **Delete** toggle is on. Can be given **Manage team**."],
          ["Viewer", "Read-only everywhere, regardless of access settings."],
          ["Partner", "Read-only delivery plus their own partner earnings. Never gets edit access."],
        ],
      },
      { type: "h2", text: "Access presets" },
      {
        type: "table",
        head: ["Preset", "Modules", "Project tabs"],
        rows: [
          ["Full", "Projects, Finance, Partners, Leads, Documents — all Edit", "All"],
          ["Progress", "Projects Edit, Documents View; Leads, Finance, Partners Off", "All except Charges and Split"],
          ["Partner", "Projects View, Documents View, Partners View; Leads and Finance Off", "All except Charges, Split, and Credentials"],
          ["Custom", "You choose Off / View / Edit per module", "You choose"],
        ],
      },
      { type: "h2", text: "Custom access" },
      {
        type: "list",
        items: [
          "Set each module — Projects, Finance, Partners, Leads, Documents — to **Off**, **View**, or **Edit**.",
          "Projects, Leads, and Partners have a **Delete** toggle (only with Edit). Leads delete also covers clients.",
          "**Project tabs** chooses which tabs show inside projects: Overview, Milestones, Work, Documents, Charges, Split, Credentials.",
          "Charges and Split also require Finance access.",
        ],
      },
      { type: "h2", text: "Rules to know" },
      {
        type: "list",
        items: [
          "A module turned off for the whole studio is hidden from everyone.",
          "Without Finance access, no amounts appear anywhere — not on Home, clients, projects, milestones, or leads.",
          "Members only see projects they're on (owners and admins see all). See [Project teams](/docs/project-teams).",
          "Teammates with **Manage team** can only grant access up to their own level and can't invite admins.",
          "Choosing Full or Progress for a Partner switches their role to Member — partners can only view.",
        ],
      },
      {
        type: "callout",
        tone: "tip",
        title: "A good default",
        text: "Give designers and developers **Progress** — they run projects and docs without ever seeing rates, balances, or pipeline value. Give external collaborators the **Partner** role.",
      },
    ],
  },
  {
    slug: "project-teams",
    title: "Project teams and visibility",
    summary: "Control who can open each project, who can be assigned tasks, and who leads it.",
    category: "team",
    kind: "how-to",
    related: ["roles-and-access", "tasks-and-boards", "credentials"],
    blocks: [
      {
        type: "p",
        text: "Owners and admins see every project. Everyone else sees only the projects whose team they're on — plus partners assigned to a project. The same rule covers its milestones, tasks, boards, work logs, and credentials.",
      },
      { type: "h2", text: "Add people to a project" },
      {
        type: "steps",
        items: [
          { title: "Open the project → Split → Team", body: "The **Project team** panel opens." },
          { title: "Tick teammates under Add teammates", body: "Owners, admins, and members who aren't on the team yet." },
          { title: "Role on project", body: "**Member** or **Lead**." },
          { title: "Click Add selected", body: "They're notified and can now see the board and tasks." },
        ],
      },
      {
        type: "p",
        text: "Or invite someone new by email right from the same panel — the invite is scoped to this project. You can also set projects from **Team → Access → Projects**.",
      },
      {
        type: "callout",
        tone: "note",
        text: "Whoever creates a project becomes its lead automatically. Only project team members can be assigned tasks.",
      },
      { type: "h2", text: "Remove someone" },
      {
        type: "p",
        text: "Click **Remove** next to them under **Has access**. They lose access to the project immediately; their work is kept.",
      },
    ],
  },
  {
    slug: "client-portal",
    title: "Share a read-only client portal",
    summary: "Create a private link so clients or partners can see their invoices, milestones, documents, or earnings.",
    category: "team",
    kind: "how-to",
    related: ["invoices", "milestones", "partners"],
    blocks: [
      {
        type: "p",
        text: "The portal is an optional module. When it's enabled for your studio, a **Portal** section appears in **Studio settings** for people who can make changes.",
      },
      {
        type: "steps",
        items: [
          { title: "Studio settings → Portal", body: "" },
          { title: "Kind", body: "**Client portal** or **Partner portal**, then pick the client or partner." },
          { title: "Label", body: "For example “Q2 client share”." },
          { title: "Choose what to expose", body: "Clients: invoices, milestones, documents, files. Partners: earnings." },
          { title: "Expiry (optional)", body: "The link stops working after this date." },
          { title: "Click Create share link", body: "Copy the URL now — it's shown once and never again. Send it to your client." },
        ],
      },
      { type: "h2", text: "What the client sees" },
      {
        type: "list",
        items: [
          "No login needed. The page is read-only and never shows internal notes or partner splits.",
          "Milestones show project, due date, and delivery status — no amounts.",
          "Documents show only those that are sent, accepted, or signed.",
          "Partner links show Earned, Settled, and Payable.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text: "Anyone with the link can view it. Set an expiry and **Revoke** links you no longer need — revoking takes effect immediately.",
      },
    ],
  },
];
