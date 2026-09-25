import type { DocArticle } from "../types";

export const MONEY: DocArticle[] = [
  {
    slug: "billing-basics",
    title: "How billing works in Worklane",
    summary:
      "Charges, payments, platform fees, and net — the money model behind Finance, projects, and partner splits.",
    category: "money",
    kind: "guide",
    related: ["charges", "record-payments", "partner-splits"],
    blocks: [
      {
        type: "p",
        text: "Worklane keeps a simple ledger per client. Understanding four ideas makes every money screen make sense.",
      },
      {
        type: "table",
        head: ["Idea", "What it means"],
        rows: [
          ["Charge", "Something the client owes — from a milestone, a work log, a contracted amount, an invoice line, or added by hand."],
          ["Payment", "Money the client sent. It's applied to charges, oldest first, unless you pick a specific charge."],
          ["Platform fee", "The marketplace's cut (0%, 4%, 5% Upwork, or 13%). Net = gross × (1 − fee)."],
          ["Outstanding", "Charges minus payments applied — what **Clients owe**."],
        ],
      },
      { type: "h2", text: "The billing loop" },
      {
        type: "steps",
        items: [
          { title: "Bill the work", body: "Charge a milestone, log hours, or post a contracted charge. See [Post charges](/docs/charges)." },
          { title: "Record the payment", body: "When money lands, record it on Finance → Collect. See [Record payments](/docs/record-payments)." },
          { title: "Partners share", body: "Partner earnings post automatically from the project split. See [Partner splits](/docs/partner-splits)." },
          { title: "Settle", body: "Pay partners what they've earned. See [Settle partners](/docs/settle-partners)." },
        ],
      },
      { type: "h2", text: "Currencies" },
      {
        type: "p",
        text: "Worklane supports **USD** and **INR**. Each client has one currency, and every charge, payment, and invoice for that client uses it. Totals are always shown per currency.",
      },
      { type: "h2", text: "Charge statuses" },
      {
        type: "table",
        head: ["Status", "Meaning"],
        rows: [
          ["Unpaid", "Nothing applied yet."],
          ["Partially paid", "Some money applied, a balance remains."],
          ["Overdue", "Past its due date with a balance remaining."],
          ["Paid", "Fully covered."],
          ["Cancelled", "Voided — kept in history so the ledger stays honest."],
        ],
      },
      {
        type: "callout",
        tone: "note",
        title: "Who sees money",
        text: "Only people with Finance access see amounts anywhere in Worklane — charges, totals, pipeline value, milestone amounts, and the Charges and Split tabs. Everyone else sees the work without the numbers.",
      },
    ],
  },
  {
    slug: "charges",
    title: "Post charges",
    summary:
      "Bill a milestone, a contracted amount, hourly work, or a one-off charge — and cancel one safely if needed.",
    category: "money",
    kind: "how-to",
    related: ["billing-basics", "milestones", "record-payments", "invoices"],
    blocks: [
      {
        type: "p",
        text: "How you post a charge depends on the project's billing mode. Every charge records gross, the platform fee, and net.",
      },
      { type: "h2", text: "Charge a milestone" },
      {
        type: "steps",
        items: [
          { title: "Open the project → Milestones", body: "Or click **Bill** on Finance → To bill, which opens the milestone highlighted." },
          { title: "Open the milestone's … menu and choose Charge", body: "Available on Milestones and Manual projects, when the milestone has an amount and isn't cancelled." },
          { title: "Done", body: "You'll see “Charge posted: collect when paid” and jump to the Charges tab with the payment form ready." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Each milestone can be charged once, and its amount locks after charging.",
      },
      { type: "h2", text: "Charge a contracted amount" },
      {
        type: "p",
        text: "On **Single contracted charge** or **Manual** projects, use **… → Post contracted charge** in the project header. It posts one charge for the contracted amount, memo “Contracted · {project}”.",
      },
      { type: "h2", text: "Hourly work" },
      {
        type: "p",
        text: "On **Hourly** projects, charges are posted automatically each time someone logs work. See [Log work](/docs/log-work).",
      },
      { type: "h2", text: "Add a one-off charge" },
      {
        type: "steps",
        items: [
          { title: "Finance → Add charge", body: "Or **+ Create → New charge**." },
          { title: "Client and gross", body: "Pick the client and enter the gross amount." },
          { title: "Fee and dates", body: "Choose the platform fee (the net is shown live), **Charged on**, and an optional **Due on**." },
          { title: "Memo and post", body: "Describe it (“June retainer”) and click **Post charge**." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "One-off charges aren't linked to a project, so they don't create partner earnings.",
      },
      { type: "h2", text: "Cancel a charge" },
      {
        type: "p",
        text: "On Finance → Collect, open a charge's **…** menu and choose **Cancel charge**. It stays in history as cancelled and outstanding updates on its own. You can only cancel open charges with nothing paid against them, and not while related partners have settlements on record.",
      },
    ],
  },
  {
    slug: "record-payments",
    title: "Record payments and collect what's owed",
    summary:
      "See who owes you, record receipts against charges, handle leftovers, and undo a receipt.",
    category: "money",
    kind: "how-to",
    related: ["billing-basics", "finance-overview", "charges"],
    blocks: [
      {
        type: "steps",
        items: [
          { title: "Go to Finance → Collect", body: "The headline shows **Past due** (if anything is overdue) or **Clients owe**." },
          { title: "Pick a client under Who owes you", body: "Filter to **Past due** to chase the oldest money first." },
          {
            title: "Optionally click Collect on a charge",
            body: "This prefills the payment form with that charge and its remaining balance.",
          },
          {
            title: "Fill in Record payment",
            body: "**Apply to** (Oldest unpaid first, or a specific charge), **Amount**, **Method** (Upwork, Bank, Stripe, Other), **Paid on**, and a **Reference**.",
          },
          { title: "Click Record", body: "You'll see “Payment recorded”. Finance managers are notified: “Payment received from {client}”." },
        ],
      },
      { type: "h2", text: "How payments are applied" },
      {
        type: "list",
        items: [
          "The chosen charge is paid first.",
          "Anything left over pays that client's older unpaid charges in the same currency, oldest first.",
          "Anything still left is kept as **Payment not applied**, and you'll see “Recorded: leftover is payment not applied”.",
          "If the project's partners earn **When collected**, their share posts as the payment is applied.",
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "You can also collect from a client's profile or a project's Charges tab — both have the same payment form.",
      },
      { type: "h2", text: "Undo a receipt" },
      {
        type: "p",
        text: "On **Money in**, open the payment's **…** menu and choose **Undo receipt**. It stays in history as cancelled, and anything it paid goes back onto outstanding. Undo is blocked while related partners have settlements on record.",
      },
    ],
  },
  {
    slug: "finance-overview",
    title: "Finance: Collect, To bill, Money in, Month wrap",
    summary: "A tour of every Finance tab and what each number means.",
    category: "money",
    kind: "reference",
    related: ["record-payments", "charges", "invoices"],
    blocks: [
      {
        type: "p",
        text: "Finance follows the money in the order it moves: **Bill work → Record payment → Partners share → Done**.",
      },
      { type: "h2", text: "Collect" },
      {
        type: "list",
        items: [
          "**Do next** suggests the first of: collect past due, collect, apply leftover, bill next milestones, or settle partners.",
          "**Paid to you** — payments applied to charges. **Payment not applied** — leftover credit.",
          "**Who owes you** lists clients with balances. Select one to see their charges: Charged, Due, Gross, Paid, Left, Status.",
          "**Money mix** splits booked value into Paid to you, Clients owe, and Unbilled. **Collections** charts net receipts for six months.",
        ],
      },
      { type: "h2", text: "To bill" },
      {
        type: "p",
        text: "Milestones with an amount that haven't been charged, with **Ready to bill · {next month}** and a two-month look-ahead. **Bill** opens the milestone on its project, where you post the charge.",
      },
      { type: "h2", text: "Money in" },
      {
        type: "p",
        text: "Every payment and refund with date, client, method, what it was applied to, and amount. Undo a receipt from its **…** menu.",
      },
      { type: "h2", text: "Month wrap" },
      {
        type: "p",
        text: "Pick a month for the closing picture: opening balance, **Still open at month end**, **Charged**, and **Paid to you**, plus partner shares (Earned / Settled / To pay), what's ready to bill, and the month's charges and receipts.",
      },
      {
        type: "callout",
        tone: "tip",
        text: "Close each month by opening Month wrap, clearing anything in Ready to bill, and settling partners with a To pay balance.",
      },
    ],
  },
  {
    slug: "invoices",
    title: "Create, issue, and send invoices",
    summary:
      "Draft an invoice with lines, issue it to the ledger with a real number, email it, and download a branded PDF.",
    category: "money",
    kind: "how-to",
    related: ["invoice-settings", "record-payments", "charges"],
    blocks: [
      {
        type: "p",
        text: "Open invoices from the **Invoices** button in the Finance toolbar. Invoices move from **Draft** to **Issued** (with a real number and ledger charges) to **Sent**.",
      },
      { type: "h2", text: "1. Create a draft" },
      {
        type: "steps",
        items: [
          { title: "Click New invoice", body: "Pick the **Client** and a **Template** (or Org defaults)." },
          { title: "Due date", body: "Prefilled from your default due days (14 unless changed)." },
          { title: "First line (optional)", body: "Description, **Qty**, **Unit amount**, and **Tax bps** (1800 bps = 18%). Leave it blank to use the template's starter lines." },
          { title: "Click Create draft", body: "The draft opens with a live preview on the left." },
        ],
      },
      { type: "h2", text: "2. Edit lines and details" },
      {
        type: "list",
        items: [
          "Apply a different **Template** to swap terms, memo, and due date.",
          "Edit **Due on**, **Terms**, and **Memo**, then **Save details**.",
          "Add lines with Description, Qty, Amount, and Tax bps, then **Add line**. Edit or delete existing lines.",
        ],
      },
      { type: "h2", text: "3. Issue" },
      {
        type: "p",
        text: "Click **Issue**. The invoice gets its number (for example INV-0001), one ledger charge is posted per line, the branding is frozen, and a PDF is stored. Issued invoices can no longer be edited.",
      },
      {
        type: "callout",
        tone: "warning",
        text: "Don't issue an invoice for work you've already charged through a milestone or work log — issuing posts new charges, so the client would be billed twice.",
      },
      { type: "h2", text: "4. Send" },
      {
        type: "p",
        text: "Click **Send email** to email the client's primary contact (or the first contact with an email). If email isn't configured, Worklane opens your mail app with a prefilled message instead. Either way the invoice is marked **Sent**.",
      },
      { type: "h2", text: "PDF and void" },
      {
        type: "list",
        items: [
          "**PDF** opens a branded A4 PDF — it works for drafts too.",
          "**Void** cancels the invoice and every charge it created.",
        ],
      },
      { type: "h2", text: "Getting paid" },
      {
        type: "p",
        text: "Payments are recorded against the charges the invoice created, on **Finance → Collect**. See [Record payments](/docs/record-payments).",
      },
    ],
  },
  {
    slug: "invoice-settings",
    title: "Invoice numbering, branding, and templates",
    summary: "Set your number prefix, default terms and tax, logo, accent colour, layout, and reusable templates.",
    category: "money",
    kind: "how-to",
    related: ["invoices"],
    blocks: [
      {
        type: "p",
        text: "Go to **Studio settings → Invoices** (or **Configure** on the Invoices page).",
      },
      {
        type: "table",
        head: ["Setting", "What it controls"],
        rows: [
          ["Number prefix", "Letters and digits, up to 12 — for example INV or ACME."],
          ["Next number", "The next number to issue."],
          ["Default due days", "Days after issue until due (14 by default)."],
          ["Default tax (bps)", "Tax in basis points — 1800 = 18%."],
          ["Default terms / memo", "Text printed on every invoice."],
          ["Accent color", "Brand colour used on the invoice."],
          ["Layout", "**Classic**, **Minimal**, or **Bold**."],
          ["Logo", "PNG, JPEG, or WebP."],
        ],
      },
      {
        type: "p",
        text: "Click **Save invoice settings**. Changes apply to invoices issued afterwards — issued invoices keep the branding they were issued with.",
      },
      { type: "h2", text: "Templates" },
      {
        type: "p",
        text: "Templates are presets applied when you create a draft. Three are created for you — Classic (default), Minimal, and Bold. Use **New template** to add your own with a name, layout, accent, due-day and tax overrides, terms, memo, and **Default for new invoices**.",
      },
    ],
  },
  {
    slug: "partners",
    title: "Add and manage partners",
    summary:
      "Invite collaborators as partners, track their login status, and see what each has earned and been paid.",
    category: "money",
    kind: "how-to",
    related: ["partner-splits", "settle-partners", "roles-and-access"],
    blocks: [
      {
        type: "p",
        text: "Partners are collaborators who share in project revenue — freelancers, agencies, or referrers. They can log in with read-only access to the projects they're on and see their own earnings.",
      },
      { type: "h2", text: "Invite a partner" },
      {
        type: "steps",
        items: [
          { title: "Partners → Invite partner", body: "" },
          { title: "Name and email", body: "Both are required. They'll receive an invite to log in as a partner." },
          { title: "Kind", body: "**Originator**, **Participant**, or **Referral** — a label that's independent of money splits." },
          { title: "Notes", body: "Payout details or other internal notes." },
          { title: "Click Send invite", body: "If email isn't configured, the invite link is copied so you can send it yourself." },
        ],
      },
      { type: "h2", text: "Balances" },
      {
        type: "p",
        text: "The **Balances** tab lists each partner with **Earned**, **Payable**, and a login status — **Logged in**, **Invite sent**, **Invite expired**, or **Not invited**. Select a partner to resend invites, see their projects, and **Settle balance**.",
      },
      {
        type: "table",
        head: ["Tab", "Shows"],
        rows: [
          ["Balances", "Earned, payable, and details per partner."],
          ["This month", "Earned, settled, and pending for a chosen month."],
          ["Settlements", "Every payout with date, method, and amount."],
        ],
      },
      { type: "h2", text: "Edit or remove" },
      {
        type: "p",
        text: "Use the pencil to edit name, email, kind, notes, or set **Status** to **Inactive**. Deleting is only possible for partners with no splits, earnings, or settlements — otherwise set them Inactive to keep the history.",
      },
    ],
  },
  {
    slug: "partner-splits",
    title: "Set up a project split",
    summary:
      "Decide how a project's net revenue is shared: a target pool split by percentage, plus one partner who takes the remainder.",
    category: "money",
    kind: "how-to",
    related: ["partners", "settle-partners", "billing-basics"],
    blocks: [
      {
        type: "p",
        text: "A split shares a project's **distributable** amount — client total minus the platform fee — between partners. You set a **pool** (for example the build budget) divided by percentages, and optionally one partner who takes whatever remains.",
      },
      { type: "h2", text: "Example" },
      {
        type: "p",
        text: "A $8,150 project with a 5% fee has about $7,742 distributable. With a $4,800 pool split Asha 45% / Ravi 55%, and Meera on remainder, Meera's share is about $2,942.",
      },
      { type: "h2", text: "1. Add partners to the project" },
      {
        type: "p",
        text: "On the project's **Split** tab click **Partners**, tick the partners, and click **Add selected**. Only these partners can take a share.",
      },
      { type: "h2", text: "2. Set the split" },
      {
        type: "steps",
        items: [
          { title: "Click Set split", body: "You'll see Client total, Platform fee, and Distributable. Add milestone prices first if distributable is empty." },
          { title: "Build / target pool", body: "Worklane suggests 60% of distributable. The remainder updates live." },
          { title: "Label and effective date", body: "For example “LMS build pool 4800”, effective today." },
          {
            title: "Assign each partner",
            body: "Toggle **In pool** or **Remainder** (only one partner can take the remainder). Pool percentages must total 100% — lock a value and the others rebalance.",
          },
          { title: "Save version", body: "When you see “Ready · pool $X · remainder $Y”, click **Save version**." },
        ],
      },
      {
        type: "callout",
        tone: "note",
        text: "Each save creates a new version. The version with the latest effective date applies to future charges — earnings already posted aren't recalculated.",
      },
      { type: "h2", text: "When partners earn" },
      {
        type: "table",
        head: ["Partner earn on", "Earnings post when…"],
        rows: [
          ["When charged", "A milestone, work log, or contracted charge is posted."],
          ["When collected", "A payment is applied to a project charge — in proportion to what was paid."],
        ],
      },
      {
        type: "p",
        text: "The Split tab shows each partner's target, earned to date, and what's still to come, plus the charges that paid them.",
      },
    ],
  },
  {
    slug: "settle-partners",
    title: "Settle partner payouts",
    summary: "Record what you've paid a partner so their payable balance stays accurate.",
    category: "money",
    kind: "how-to",
    related: ["partners", "partner-splits"],
    blocks: [
      {
        type: "p",
        text: "**Payable** is what a partner has earned minus what's been settled. Settling records a payout — it doesn't touch client receipts.",
      },
      {
        type: "steps",
        items: [
          { title: "Click Settle", body: "From the Partners toolbar, a partner's **Settle balance**, Finance's Partner shares panel, or Home's Do next card." },
          { title: "Pick the partner", body: "The amount is prefilled with their payable balance." },
          { title: "Method and date", body: "**Bank** by default; Upwork, Stripe, or Other also work." },
          { title: "Memo", body: "For example “August payout”." },
          { title: "Click Record settlement", body: "The partner is notified if they have a login: “Payout recorded”." },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text: "Settlements can't be undone from the app, and once a partner has settlements, related charges and receipts can no longer be cancelled. Double-check the amount before recording.",
      },
    ],
  },
];
