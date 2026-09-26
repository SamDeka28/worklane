import type { DocArticle } from "../types";

export const ACCOUNT: DocArticle[] = [
  {
    slug: "notifications",
    title: "Notifications and email preferences",
    summary:
      "Use the bell and inbox, mark items read, and choose which updates also reach your email.",
    category: "account",
    kind: "how-to",
    related: ["mentions", "navigating-worklane"],
    blocks: [
      { type: "h2", text: "The bell" },
      {
        type: "list",
        items: [
          "The badge shows unread count and updates live — new notifications also pop up as a toast.",
          "Switch between **All** and **Unread**, or **Mark all read**.",
          "Click an item to open what it's about. Its **…** menu marks it read/unread or deletes it.",
          "**View all** opens the full inbox; the gear opens email settings.",
        ],
      },
      { type: "h2", text: "The inbox" },
      {
        type: "p",
        text: "The Notifications page groups items by day, filters by **Unread** and category, and loads older items 30 at a time.",
      },
      { type: "h2", text: "Choose what reaches your email" },
      {
        type: "p",
        text: "In-app notifications are always on. In the **Email me about** card, switch each category on or off, then click **Save email settings**. Preferences apply across all your studios.",
      },
      {
        type: "table",
        head: ["Category", "When", "Email by default"],
        rows: [
          ["Mentions", "Someone @mentions you", "On"],
          ["Tasks", "A task is assigned to you", "On"],
          ["Comments", "New comments on tasks you're on", "Off"],
          ["Projects", "You're added to a project", "On"],
          ["Leads", "Someone moves a lead you own", "On"],
          ["Clients", "Clients added or removed (owners)", "On"],
          ["Payments & invoices", "Payments received; invoices created, issued, sent, voided", "Off"],
          ["Partner payouts", "Settlements for your partner profile", "On"],
          ["Team & access", "Invites accepted, your access changed", "On"],
          ["General", "Other studio updates", "On"],
        ],
      },
      { type: "h2", text: "Client activity on documents" },
      {
        type: "p",
        text: "When you send a document, you're notified under **Clients** the first time the client opens the email and the first time they view the link, and whenever they comment, suggest a change, request changes, or sign. **Changes requested** and **signed** always email you, whatever your settings. Signed notifications attach the signed PDF, plus the signature certificate once both sides have signed.",
      },
      {
        type: "callout",
        tone: "note",
        text: "You're never notified about your own actions. Studio owners receive a copy of most studio notifications.",
      },
    ],
  },
  {
    slug: "mentions",
    title: "@ mentions",
    summary: "Tag people, clients, projects, milestones, and tasks in notes, comments, and documents.",
    category: "account",
    kind: "how-to",
    related: ["notifications", "documents", "tasks-and-boards"],
    blocks: [
      {
        type: "p",
        text: "Type **@** in task descriptions, comments, lead notes, or documents. A menu appears grouped into **People**, **Partners**, **Clients**, **Leads**, **Projects**, **Milestones**, and **Tasks**.",
      },
      {
        type: "keys",
        items: [
          { keys: ["@"], label: "Open the menu" },
          { keys: ["↑", "↓"], label: "Move" },
          { keys: ["Enter"], label: "Insert tag (Tab also works)" },
          { keys: ["Esc"], label: "Close" },
        ],
      },
      { type: "h2", text: "Who gets notified" },
      {
        type: "list",
        items: [
          "Tagged teammates and partners with a login get “{Name} mentioned you in …” with a **View mention** link.",
          "Only newly added mentions notify — editing a comment won't ping people twice.",
          "You only see things in the menu you have access to — for example, Clients and Leads need Leads access.",
        ],
      },
    ],
  },
  {
    slug: "profile-and-appearance",
    title: "Profile and themes",
    summary: "Set your name and photo, and pick from twelve editor-style themes that follow you across devices.",
    category: "account",
    kind: "how-to",
    related: ["navigating-worklane", "keyboard-shortcuts"],
    blocks: [
      { type: "h2", text: "Your profile" },
      {
        type: "steps",
        items: [
          { title: "Account menu → Profile", body: "" },
          { title: "Photo", body: "**Upload photo** — a square PNG, JPEG, WebP, or GIF under 5 MB. Google photos sync on sign-in unless you've uploaded your own." },
          { title: "Display name", body: "Shown on cards, comments, and mentions." },
          { title: "Contact details", body: "**Job title**, **Phone**, and **Location** show next to your name on the Team page. **Mailing address** is optional. Everyone in your studios can see your profile details." },
          { title: "Click Save profile", body: "" },
        ],
      },
      { type: "h2", text: "Studio business details" },
      {
        type: "p",
        text: "In **Studio settings → Business details**, owners and editors set the studio's legal name, address, email, phone, tax ID, website, and registration numbers like PAN or CIN. Invoices print these in **Billed by**. They're the same details as the **Business details** tab in invoice settings, so editing either place updates both.",
      },
      { type: "h2", text: "Themes" },
      {
        type: "p",
        text: "Open **Appearance** from the account menu, Studio settings, or ⌘K. Click a theme and it applies instantly; it's saved to your account and follows you to every device.",
      },
      {
        type: "table",
        head: ["Theme", "Style"],
        rows: [
          ["System", "Matches your device, light or dark"],
          ["Worklane Dark", "Deep violet night — the default"],
          ["Worklane Light", "Cool slate with violet accents"],
          ["Midnight", "Ink black, indigo to sky"],
          ["Aurora", "Polar night, mint to violet"],
          ["Volt", "Carbon black, electric lime"],
          ["Sunset", "Dusky rose, coral to pink"],
          ["Deep Sea", "Midnight navy, cyan to indigo"],
          ["Evergreen", "Forest night, mint to lime"],
          ["Orchid", "Plum night, pink to lavender"],
          ["Mono", "Pure grayscale, zero distraction"],
          ["Cloud", "Crisp white, electric blue"],
          ["Mint", "Cool mint, teal to green"],
          ["Blush", "Soft pink, rose to violet"],
          ["Sunrise", "Soft peach, tangerine to rose"],
          ["Paper", "Warm off-white, ink-black type"],
        ],
      },
      { type: "h3", text: "Style, surface and components" },
      {
        type: "p",
        text: "The tabs above the themes hold three more settings. **Style** sets the material of every card: **Clean** (the default), **Glass** (frosted, translucent layers), **Neumorphic** (soft extruded shapes in one tone), **Clay** (puffy and playful), or **Brutalist** (bold outlines and hard shadows). **Surface** sets what sits behind each page: **Tinted** (the default), **Gradient**, **Solid**, **Outline**, or **Open** (cards float on the background). **Components** sets the shape of cards, buttons, and fields, from **Fluid** and **Soft** (pill buttons) through **Balanced** to **Crisp** and **Sharp** (square corners). The preview updates as you hover, and every choice saves to your account.",
      },
      {
        type: "callout",
        tone: "tip",
        text: "Quick switch: account menu → **Appearance** lists every theme with a swatch. In the gallery, arrow keys preview themes as you move.",
      },
    ],
  },
  {
    slug: "keyboard-shortcuts",
    title: "Keyboard shortcuts",
    summary: "Every shortcut in Worklane, from the command palette to comments and the document editor.",
    category: "account",
    kind: "reference",
    related: ["navigating-worklane", "document-editor"],
    blocks: [
      { type: "h2", text: "Everywhere" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "K"], label: "Open or close the command palette" },
          { keys: ["↑", "↓", "Enter"], label: "Move and choose in menus" },
          { keys: ["Esc"], label: "Close sheets, dialogs, and menus" },
        ],
      },
      { type: "h2", text: "Tasks and comments" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "Enter"], label: "Send a comment" },
          { keys: ["Enter", ","], label: "Add a label" },
          { keys: ["Backspace"], label: "Remove the last label (in an empty label field)" },
          { keys: ["@"], label: "Mention something" },
        ],
      },
      { type: "h2", text: "Document editor" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "B"], label: "Bold" },
          { keys: ["⌘/Ctrl", "I"], label: "Italic" },
          { keys: ["⌘/Ctrl", "U"], label: "Underline" },
          { keys: ["⌘/Ctrl", "⇧", "."], label: "Bigger text" },
          { keys: ["⌘/Ctrl", "⇧", ","], label: "Smaller text" },
          { keys: ["Tab", "⇧ Tab"], label: "Indent / outdent" },
        ],
      },
      { type: "h2", text: "Theme gallery" },
      {
        type: "keys",
        items: [
          { keys: ["←", "→", "↑", "↓"], label: "Move between themes (applies as you go)" },
          { keys: ["Home", "End"], label: "First or last theme" },
        ],
      },
      { type: "h2", text: "Boards" },
      {
        type: "p",
        text: "Drag with a mouse after a small movement; on touch screens, press and hold a card briefly before dragging so normal swipes still scroll.",
      },
    ],
  },
  {
    slug: "security",
    title: "Security and privacy",
    summary: "How Worklane keeps studio data separate, limits what each person can see, and protects credentials.",
    category: "account",
    kind: "guide",
    related: ["credentials", "roles-and-access", "project-teams"],
    blocks: [
      { type: "h2", text: "Access is enforced by the database" },
      {
        type: "p",
        text: "Permissions aren't just hidden buttons. Every studio's data is isolated, and row-level security in the database checks your studio membership, role, and project membership on reads and writes. If you're not on a project, its tasks and credentials simply don't come back.",
      },
      { type: "h2", text: "Money stays with the right people" },
      {
        type: "p",
        text: "Without Finance access, amounts don't appear anywhere in the app — Home, clients, projects, milestones, or leads. Partners only see their own earnings.",
      },
      { type: "h2", text: "Credential vault" },
      {
        type: "list",
        items: [
          "Secrets are encrypted with AES-256-GCM before they're stored, and each one is bound to its own record so it can't be moved or tampered with undetected.",
          "Encrypted secrets live in storage that no signed-in user can query directly — not even owners. They're decrypted on the server only after an access check.",
          "Lists never include secrets; you must explicitly reveal one, and every reveal and copy is written to an append-only history.",
          "Revealed secrets auto-hide after 45 seconds.",
        ],
      },
      { type: "h2", text: "Files and links" },
      {
        type: "list",
        items: [
          "Attachments are private. Download links are signed and expire after an hour.",
          "Portal share links are stored hashed, shown only once, can expire, and can be revoked instantly.",
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "Review who has **Full** access every quarter, and prefer restricted credentials for production systems.",
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting and FAQ",
    summary: "Quick answers to the questions teams ask most often.",
    category: "account",
    kind: "reference",
    related: ["roles-and-access", "project-teams", "invite-teammates"],
    blocks: [
      { type: "h3", text: "A teammate can't see a project" },
      {
        type: "p",
        text: "Members only see projects they're on. Add them from **Split → Team** on the project, or **Team → Access → Projects**. See [Project teams](/docs/project-teams).",
      },
      { type: "h3", text: "I can't assign someone to a task" },
      { type: "p", text: "Assignees must be on the project team. Add them first, then reopen the card." },
      { type: "h3", text: "New project is greyed out" },
      { type: "p", text: "Every project belongs to a client. Create a client (or convert a lead) first." },
      { type: "h3", text: "I don't see amounts, or the Charges and Split tabs" },
      { type: "p", text: "Those need Finance access. Ask an owner or admin to change your access preset." },
      { type: "h3", text: "I can't delete a client" },
      {
        type: "p",
        text: "Clients with projects, charges, invoices, or payments can't be deleted — use **Archive** instead to take them off the active list.",
      },
      { type: "h3", text: "The Charge option is missing on a milestone" },
      {
        type: "p",
        text: "Charge is available on Milestones and Manual projects when the milestone has an amount and isn't cancelled. Hourly projects bill through work logs instead.",
      },
      { type: "h3", text: "An invite link says it's expired or unavailable" },
      {
        type: "p",
        text: "Invites last 14 days and resending creates a new link. Ask the sender to **Resend** from Team → Pending invites, and make sure you sign in with the invited email.",
      },
      { type: "h3", text: "I can't cancel a charge or undo a receipt" },
      {
        type: "p",
        text: "Charges with payments applied can't be cancelled, and both actions are blocked while related partners have settlements on record.",
      },
      { type: "h3", text: "Invite, invoice, or document emails aren't arriving" },
      {
        type: "p",
        text: "If Team shows **Email not configured**, the studio's email (SMTP) isn't set up. Invite links are copied for you to share yourself. For invoices, download the **PDF** and use **I sent it another way**. Documents are sent by email, so sending one needs email set up. If email is configured, ask the recipient to check spam and look at the document's **Delivery log** to confirm the address it went to. **Copy link** there gives you the client's link to share another way.",
      },
      { type: "h3", text: "I can't edit a sent or signed document" },
      {
        type: "p",
        text: "The first signature locks that version. To change anything, create a new revision and publish it to the same link. See [Send, sign, and version documents](/docs/sign-and-version).",
      },
      { type: "h3", text: "The client signed, but I still need to sign" },
      {
        type: "p",
        text: "Open the document and use the **Countersign** card in the right-hand panel. Either side can sign first; the version shows **Fully signed** once both have signed, and the client is emailed the signed PDF and certificate.",
      },
      { type: "h3", text: "An invoice won't issue: “Already charged”" },
      {
        type: "p",
        text: "A line is linked to a milestone or work log that already has an open charge. Remove the line, or click **Issue anyway (double bill)** if you really mean to bill it twice. See [Invoices](/docs/invoices).",
      },
      { type: "h3", text: "My theme didn't change" },
      {
        type: "p",
        text: "Themes save to your account after a short pause. If a page looks stale after switching, refresh it once.",
      },
    ],
  },
];
