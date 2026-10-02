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
          "Click an item to open what it's about and mark it read. Its **…** menu has **Mark as read** / **Mark as unread** and **Delete**.",
          "**View all** opens the full inbox; the gear opens email settings.",
        ],
      },
      { type: "h2", text: "The inbox" },
      {
        type: "p",
        text: "The Notifications page groups items by day (**Today**, **Yesterday**, then dates). Filter by **All** or **Unread** and by category, and click **Load older** to fetch 30 more.",
      },
      { type: "h2", text: "Choose what reaches your email" },
      {
        type: "p",
        text: "In-app notifications are always on. In the **Email me about** card, switch each category on or off, then click **Save email settings**. Preferences apply across all your studios. If email isn't configured for your Worklane deployment, only in-app notifications are sent.",
      },
      {
        type: "table",
        head: ["Category", "When", "Email by default"],
        rows: [
          ["Mentions", "Someone @mentions you", "On"],
          ["Tasks", "A task is assigned to you", "On"],
          ["Comments", "New comments on tasks you're assigned to or discussing", "Off"],
          ["Projects", "You're added to a project", "On"],
          ["Leads", "A lead you own changes stage, a lead is handed to you, a new enquiry arrives, or a lead opens your email", "On"],
          ["Clients", "Clients added or removed (owners), and client activity on documents you sent", "On"],
          ["Tracked emails", "The first time someone opens an email you tracked", "Off"],
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
      { type: "h2", text: "Email open alerts" },
      {
        type: "p",
        text: "You hear about the first open of a tracked email (under **Tracked emails**), a document email (under **Clients**), and a lead email (under **Leads**). These open alerts appear in the app only — they aren't emailed or copied to owners, whatever your settings.",
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
        text: "Type **@** in any rich-text field that shows **Type @ to tag** — task descriptions, comments, lead notes, documents, and client, partner, project, and milestone notes. A menu appears grouped into **People**, **Partners**, **Clients**, **Leads**, **Projects**, **Milestones**, and **Tasks**. Keep typing to filter.",
      },
      {
        type: "p",
        text: "In documents, the menu also offers **Create client**, project, milestone, or task, so you can add one without leaving the editor.",
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
          "Mentions notify from task descriptions, comments, lead notes, and documents. Tags in other notes are links only.",
          "Only newly added mentions notify — editing a task description, lead note, or document won't ping people twice.",
          "Someone mentioned in a comment gets the mention, not a separate comment notification.",
          "You only see things in the menu you have access to — Clients and Leads need Leads access; Projects, Milestones, and Tasks need Projects access.",
        ],
      },
    ],
  },
  {
    slug: "profile-and-appearance",
    title: "Profile and themes",
    summary: "Set your name and photo, and pick from fifteen themes that follow you across devices.",
    category: "account",
    kind: "how-to",
    related: ["navigating-worklane", "keyboard-shortcuts"],
    blocks: [
      { type: "h2", text: "Your profile" },
      {
        type: "steps",
        items: [
          { title: "Account menu → Profile", body: "At the bottom of the sidebar." },
          { title: "Photo", body: "**Upload photo** (or **Change photo**) — a square PNG, JPEG, WebP, or GIF under 5 MB. **Remove** clears it. Google photos sync on sign-in unless you've uploaded your own." },
          { title: "Display name", body: "Required. Shown on cards, comments, and mentions." },
          { title: "Contact details", body: "**Job title**, **Phone**, and **Location** show next to your name on the Team page. **Mailing address** is optional. Teammates in your studios can see your profile details." },
          { title: "Click Save profile", body: "" },
        ],
      },
      {
        type: "p",
        text: "**Email** is read-only — it's managed by your sign-in provider.",
      },
      { type: "h2", text: "Email signature" },
      {
        type: "p",
        text: "Under **Email signature** on your Profile, choose **Studio signature** (the one an owner or admin set in **Settings**), **My own**, or **None**. Your choice saves right away. **My own** opens the editor with a live preview beside it; click **Save signature** there, and **Edit signature** later to change it. It's added below lead emails and Compose emails you send. If your studio uses one signature for everyone, you'll see it here without choices. See [Add a signature](/docs/email-tracking).",
      },
      { type: "h2", text: "Studio business details" },
      {
        type: "p",
        text: "In **Studio settings**, open **Business details** in the left menu. Owners, admins, and members with edit access set the studio's legal name, address, email, phone, tax ID, website, and registration numbers like PAN or CIN under **More details**, then click **Save business details**. Invoices print these in **Billed by**. They're the same details as the **Business details** tab in invoice settings, so editing either place updates both.",
      },
      { type: "h2", text: "Themes" },
      {
        type: "p",
        text: "Open **Appearance** from the account menu or ⌘K. The gallery groups themes into **Worklane**, **Dark**, and **Light**. Click a theme and it applies instantly; it's saved to your account and follows you to every device.",
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
        text: "The tabs above the themes hold three more settings. **Style** sets the material of every card: **Clean** (the default), **Glass** (frosted, translucent layers), **Neumorphic** (soft extruded shapes in one tone), **Clay** (puffy and playful), or **Brutalist** (bold outlines and hard shadows). **Surface** sets what sits behind each page: **Tinted** (the default), **Gradient**, **Solid**, **Outline**, or **Open** (cards float on the background). **Components** sets the shape of cards, buttons, and fields, from **Fluid** and **Soft** (pill buttons) through **Balanced** (the default) to **Crisp** and **Sharp** (square corners). The preview updates as you hover, and every choice saves to your account. **Reset to defaults** returns to Worklane Dark, Clean, Tinted, and Balanced.",
      },
      {
        type: "callout",
        tone: "tip",
        text: "Quick switch: account menu → **Appearance** lists every theme with a swatch, plus **Browse all themes…**. In the gallery, arrow keys apply themes as you move.",
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
          { keys: ["←", "→"], label: "Switch tabs in a sheet header" },
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
      { type: "h2", text: "Leads and emails" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "Enter"], label: "Log a lead activity, or send an email from a lead or the Emails page" },
          { keys: ["@"], label: "Insert a variable like first name or company in an email subject or message" },
          { keys: ["↑", "↓", "Enter", "Tab"], label: "Pick a variable from the @ list" },
        ],
      },
      { type: "h2", text: "Document editor" },
      {
        type: "keys",
        items: [
          { keys: ["⌘/Ctrl", "S"], label: "Save" },
          { keys: ["⌘/Ctrl", "⇧", "F"], label: "Enter or exit full screen (Esc also exits)" },
          { keys: ["⌘/Ctrl", "Z"], label: "Undo" },
          { keys: ["⌘/Ctrl", "⇧", "Z"], label: "Redo" },
          { keys: ["⌘/Ctrl", "B"], label: "Bold" },
          { keys: ["⌘/Ctrl", "I"], label: "Italic" },
          { keys: ["⌘/Ctrl", "U"], label: "Underline" },
          { keys: ["⌘/Ctrl", "⇧", "S"], label: "Strikethrough" },
          { keys: ["⌘/Ctrl", "⇧", "8"], label: "Bulleted list" },
          { keys: ["⌘/Ctrl", "⇧", "7"], label: "Numbered list" },
          { keys: ["⌘/Ctrl", "⇧", "9"], label: "Checklist" },
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
      { type: "h2", text: "Help docs" },
      {
        type: "keys",
        items: [
          { keys: ["/"], label: "Jump to search on the docs home page" },
          { keys: ["↑", "↓", "Enter"], label: "Pick a search result" },
        ],
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
      { type: "h2", text: "Signing in" },
      {
        type: "list",
        items: [
          "Sign in with email and password (at least 8 characters) or with **Google**.",
          "New accounts confirm their email with a code before signing in. If you try to sign in unconfirmed, a new code is sent.",
          "**Forgot password?** on the sign-in page emails a reset code. Enter it with your new password and click **Update password**.",
          "Codes can be resent after 60 seconds. **Sign out** is in the account menu and ⌘K.",
        ],
      },
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
        text: "Clients with projects, charges, invoices, or payments can't be deleted — use **Archive** instead to take them off the active list. Deleting also needs delete permission; owners and admins always have it.",
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
        text: "If Team shows **Email not configured**, the studio's email (SMTP) isn't set up. Invite links are copied for you to share yourself. For invoices, download the **PDF** and use **I sent it another way**. Documents, lead emails, and Compose can still send if an owner or admin connects the studio's mailbox under **Settings → Sending email**, and lead emails can also go out from your own mailbox in **CRM settings → Mailbox** (see [Choose the address emails come from](/docs/email-tracking)); if one fails, click **Send test email** there to see the error. If email is configured, ask the recipient to check spam and look at the document's **Delivery log** to confirm the address it went to. **Copy link** there gives you the client's link to share another way.",
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
      { type: "h3", text: "I'm not getting notification emails" },
      {
        type: "p",
        text: "Check the category is on under **Notifications → Email me about**, and that you clicked **Save email settings**. If the card says email isn't configured, only in-app notifications are sent. Email open alerts are in-app only. See [Notifications](/docs/notifications).",
      },
      { type: "h3", text: "I forgot my password" },
      {
        type: "p",
        text: "Click **Forgot password?** on the sign-in page, then **Send reset code**. Enter the code from the email with a new password. If you signed up with Google, use the **Google** button instead.",
      },
      { type: "h3", text: "My theme didn't change" },
      {
        type: "p",
        text: "Themes save to your account after a short pause. If a page looks stale after switching, refresh it once.",
      },
    ],
  },
  {
    slug: "assistants",
    title: "Connect an assistant",
    summary: "Let ChatGPT, Claude, or Cursor read your studios after you sign in to Worklane.",
    category: "account",
    kind: "how-to",
    related: ["notifications"],
    blocks: [
      {
        type: "p",
        text: "Worklane can answer an assistant's questions about your studios, clients, projects, invoices, and leads. Connecting one opens the same Worklane sign-in or sign-up you already use. After you allow it, Worklane shares a token with that assistant. You never paste a secret.",
      },
      { type: "h2", text: "Add the ChatGPT app" },
      {
        type: "p",
        text: "In ChatGPT, open Settings → Security and login and turn on Developer mode. Open Plugins, choose the plus button, and paste the server address from [Connect using MCP](/connect). Sign in when ChatGPT opens that page, then install the plugin from Personal. On the ChatGPT homepage, switch from Chat to Work, start a new chat, type @, and select Worklane. To update the installed plugin, upload a newer package with the same name, worklane. That package points at this server and the Worklane app.",
      },
      { type: "h2", text: "What happens when you connect" },
      {
        type: "list",
        items: [
          "ChatGPT opens the Connect page on Worklane.",
          "Sign in, or create an account, on the same screens you already use.",
          "Allow read access. Worklane sends you back to ChatGPT.",
        ],
      },
      {
        type: "p",
        text: "Reading is included with that connection. Changes need a separate allow. See [Use Worklane from ChatGPT](/docs/use-worklane-from-chatgpt).",
      },
    ],
  },
  {
    slug: "use-worklane-from-chatgpt",
    title: "Use Worklane from ChatGPT",
    summary: "Connect ChatGPT, allow changes, and see what the assistant can read, create, and send.",
    category: "account",
    kind: "how-to",
    related: ["assistants", "roles-and-access"],
    blocks: [
      {
        type: "p",
        text: "ChatGPT uses the same access you already have in the studio. Add the app from [Connect using MCP](/connect), sign in, and mention Worklane in a new chat.",
      },
      { type: "h2", text: "Read access and change access" },
      {
        type: "list",
        items: [
          "A connection can always read the records you can already open: notes, document text, emails, timelines, and settings.",
          "Creating, changing, voiding, or sending needs the write allow on the Connect page.",
          "An older connection that only allowed reading stays that way until you connect again from a change and allow it.",
        ],
      },
      { type: "h2", text: "What it can change" },
      {
        type: "p",
        text: "It can create and update clients, projects, tasks, work logs, charges, receipts, invoices, leads, documents, partners, and portal shares, using the same rules as the app. It previews a document, invoice, or email before saving or sending. Amounts are entered the way you type them on a form, such as 1500, in that client's currency.",
      },
      { type: "h2", text: "What it will not do" },
      {
        type: "list",
        items: [
          "It cannot sign you out or switch accounts.",
          "Mailbox passwords, invitation tokens, and file bytes are not copied into the chat. A vault secret appears only when you ask to reveal that entry.",
          "A PDF or image is named. The assistant does not open the file.",
        ],
      },
      { type: "h2", text: "Disconnect" },
      {
        type: "p",
        text: "Open Profile → Connected assistants and disconnect the app. The next request has to sign in again.",
      },
    ],
  },
];
