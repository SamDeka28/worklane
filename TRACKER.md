# Worklane project tracker

Living checklist for the full product. Architecture and decisions live in the plan; **this file is what we tick so nothing is missed.**

Update a box when the work is in the repo, tested, and usable — not when a stub exists.

Status: `todo` · `doing` · `done` · `blocked` · `wont`

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Foundation | doing |
| 1 | Clients | doing |
| 2 | Finance core | doing |
| 3 | Delivery + work logs | done |
| 4 | Partners | done |
| 5 | Documents | done |
| 6 | CRM + invoices | todo |
| 7 | Portal + automations | todo |

**Spreadsheet retirement** (Phases 0–4 must make this true): the Rahul × Sam workbook can close. Client remaining is derived. Partner monthly totals are derived. No “Previous carry over” row. No typed Remaining column.

---

## How to use

- Tick `- [ ]` → `- [x]` when done.
- If something is deferred, move it to [Later / out of scope](#later--out-of-scope) with a one-line reason. Do not silently drop it.
- After every phase: typecheck, lint, domain tests, `next build`, migrate, RLS smoke.
- Do not start Phase 5 (editor) until Phase 4 can reproduce the 2026 tab.

---

## Blockers before Phase 0

- [x] Worklane logo asset added to `public/` (not in repo today; do not distort)
- [x] Supabase project (Worklane `ulauxqtwpnoufmxhdswl`; CLI local stack still optional)
- [x] Auth providers decided (email + password)
- [x] Org default currency for first dogfood org: **USD**
- [ ] Credentials tab in the workbook: rotate those logins; **never seed them**

---

## Original brief coverage

Tick when the capability exists in the product, even if a later phase polished it.

### Product principles

- [ ] Connected toolbox, not a mandatory pipeline (start at client, project, payment, proposal, or SOW)
- [ ] One Client / Project / Payment / Invoice / Partner / Document — no per-module duplicates
- [ ] Modules independently usable; connected when used together
- [ ] Progressive complexity via org module flags + nav, not separate apps
- [ ] Internal-first; external access optional and permissioned
- [x] No “remaining” as an editable field
- [x] Monthly carry-forward derived from transactions
- [x] Client ledger ≠ partner ledger
- [x] Money as integer minor units + ISO currency (USD and INR at minimum)

### North-star questions the UI must answer

- [ ] Who are our leads?
- [ ] Which opportunities / pipeline items are active?
- [x] What proposals are waiting for acceptance?
- [x] What SOWs are waiting for signatures?
- [x] What projects are active?
- [x] What milestones are due?
- [x] What tasks are outstanding?
- [ ] What has been invoiced?
- [x] What has actually been paid (client)?
- [x] What remains outstanding (client)?
- [x] Which payments are overdue?
- [x] Which partners are involved?
- [x] How much has each partner earned?
- [x] How much has each partner actually been paid?
- [ ] What needs attention today?
- [ ] Complete history of a client
- [ ] Complete history of a project
- [x] Partner monthly payout register (replaces 2026 sheet)
- [x] Client monthly statement (replaces Sheet3)

---

## Phase 0 — Foundation

Gates: auth works, a user can belong to two orgs and switch, RLS denies cross-org reads, design system is the only UI kit.

- [x] Modular folder layout (`src/modules/*`, `src/shared/*`, `src/app/(auth)`, `src/app/(app)/[orgSlug]`)
- [x] `proxy.ts` (Next.js 16; not `middleware.ts`) for session/org slug only — not authz
- [x] shadcn/ui + Radix + Lucide + Tailwind 4 tokens (light/dark)
- [x] Typography, spacing, focus rings, reduced-motion
- [x] Logo + favicon + app icon (do not distort)
- [x] Supabase Postgres + Auth wired (Storage with files in a later phase)
- [x] Migrations as source of truth in `supabase/migrations`
- [x] `organizations`, `organization_members`, `organization_invitations` schema drafted
- [x] Multi-org membership + org switcher (URL `/[orgSlug]/...`)
- [x] Roles: owner, admin, member, viewer, partner
- [x] Capability checks inside every Server Function (not UI-only)
- [x] RLS on every business table: `organization_id` isolation
- [x] Module flags on org settings (crm, documents, delivery, finance, partners, portal)
- [x] App chrome: sidebar, + Create shell, Cmd+K shell
- [x] Loading / error / empty primitives
- [x] Shared `Money` helpers: parse, format, gross/fee/net, Hamilton remainder
- [x] Vitest wired; first money tests green
- [x] Scripts: `lint`, `typecheck`, `test`, `build`

**Phase 0 gate:** `tsc` + lint + tests + build pass. Sign up → create org → invite → switch org.

---

## Phase 1 — Clients (core)

- [x] `clients` (company or person)
- [x] `contacts` (email, phone, WhatsApp, primary)
- [x] Client list + search + filters
- [x] Client profile: overview, timeline, projects, work, financials, documents (empty states OK)
- [ ] `files` polymorphic attach (upload, preview, download, delete, internal vs shared)
- [x] `activities` append-only on create/update
- [ ] `audit_logs` for destructive/sensitive changes
- [x] Quick create client from Cmd+K / + Create
- [x] Notes on client (internal; never portal-visible by default)

**Phase 1 gate:** create a client + contact + file; activity shows; other org cannot see it.

---

## Phase 2 — Finance core (replace Sheet3)

Authoritative client money. No work logs yet; manual charges allowed.

- [x] `charges`: gross, fee_bps, net, currency, charged_on, due_on, source, status open/void
- [x] Platform fee optional per charge (0 / 4% / 5% / 13% must all compute)
- [x] `payments`: receipt and refund; methods include `upwork`, `bank`, `stripe`, `other`
- [x] `payment_allocations` (one payment → many charges)
- [x] FIFO default allocation (manual split UI later)
- [x] Overpayment → unallocated client credit (not extra paid on a charge)
- [x] Void payment / void charge rules
- [x] Outstanding **derived** (never editable remaining)
- [x] Overdue = outstanding + due_on < today (no due date → not overdue)
- [x] Monthly statement: opening, new charges, payments, closing — opening is **not** a charge
- [x] Client financials tab uses the statement
- [x] Finance nav: charges, payments, monthly, overdue
- [x] Record payment from client context (inherits client)
- [x] Currency: org default USD; INR allowed on a project/client; reject mixed-currency on one client
- [x] Tests: partial, split, multi, overpay, refund, void, FIFO, monthly carry-forward

**Workbook acceptance**

- [x] Latisha-like: charge $4,500 → pay $300 → pay $2,300 → outstanding $1,900 with **no** “Previous carry over” row
- [ ] Bolanle-like: $1,000 outstanding shows as outstanding, not a remark

**Phase 2 gate:** monthly view matches the formula; remaining cannot be typed.

---

## Phase 3 — Delivery + work logs (replace daily sheet rows)

- [x] `projects` with statuses: planning, active, on hold, completed, cancelled
- [x] `billing_mode`: none | single_charge | milestones | hourly | manual
- [x] `default_fee_bps` on project
- [x] Overview, scope, timeline, files, activity on project
- [x] `milestones` (name, dates, amount, status, deliverables)
- [x] Milestone billing creates a charge when billed (Vince kickoff pattern)
- [x] Lightweight `tasks` (title, assignee, due, priority, status, list + kanban) — not Jira
- [x] `work_logs`: date, hours, rate, fixed override, description, external URL (Trello)
- [x] Posting a work log in `hourly` mode creates a charge (gross = hours×rate or fixed)
- [x] Double-count guard: hourly logs must not also create a project-level contracted charge for the same work
- [x] Project financials roll up charges + payments
- [x] + Create payment/milestone/task/work log inherits project + client
- [x] Tests: hours×rate, fixed override, fees, billing-mode guards

**Workbook acceptance**

- [x] RNPL-like: several 8h × $15 lines with Trello URLs post as charges
- [x] Mixed hourly + fixed on the same project allowed

**Phase 3 gate:** a day’s work can be logged without a spreadsheet row.

---

## Phase 4 — Partners (replace 2026 tab)

- [x] `partners` as org-scoped parties (optional later user link)
- [x] Originator vs participant vs referral — independent of money
- [x] `distribution_versions` + `distribution_lines` (share_bps, sum 10000)
- [x] Per-project split (50/50, 60/40, 55/45, 70/30)
- [x] Per-charge / version override (Lawpepper-style) without rewriting history
- [x] `earn_on`: `charge` (default) | `receipt`
- [x] `partner_allocations` snapshot version id + earned_minor
- [x] Hamilton rounding so partner rows sum to net
- [x] `partner_settlements` separate from client receipts
- [x] Payable = earned − settled (derived)
- [x] Monthly payout register: rows, net, share, earned, settled, pending
- [x] Void charge/payment blocked if settlements exist (or reversal path)
- [x] Privacy: `partners.read_all` vs `read_own`; clients never see splits
- [ ] Nested waterfall **not stored**; optional compiler UI later
- [x] Tests: fee then split, version change, earn_on both modes, settlement vs earned

**Workbook acceptance**

- [x] August-like pending partner total is **derived** and matches `net × share`
- [x] Latisha June formula yields **$332.50**, not the sheet’s $350
- [x] James 60% of net after 5% fee
- [x] Done/Pending is settlement of the partner, not client payment

**Phase 4 gate:** workbook can close for money + splits. This is the spreadsheet-retirement gate.

---

## Phase 5 — Documents (proposals + SOWs)

- [x] Unified `documents` (proposal | sow | other)
- [x] TipTap editor: headings, lists, images, links (starter kit + attachments)
- [ ] Slash commands, bubble toolbar, shortcuts, autosave, undo/redo
- [ ] Structured blocks: pricing, milestones, timeline, scope, signature, client info, terms
- [x] Draft content editable; **accept/sign freezes snapshot + permanent file copy**
- [x] Signed version immutable; clone to new version for revisions
- [ ] Templates + merge fields (`{{client.name}}`, etc.)
- [x] Create SOW from proposal
- [x] Create project from snapshot as an **explicit** action
- [x] Clickwrap e-sign (name, email, timestamp, intent); provider_id for later
- [x] Signed PDF stored permanently; activity event
- [x] Version list with author + status
- [x] Send via mailto / copy link (no fake “sent” without a provider)
- [x] Tests: version lock after sign; snapshot does not mutate when project later changes

**Phase 5 gate:** send a proposal, accept, generate SOW, sign, locked PDF exists.

---

## Phase 6 — CRM + invoices + comms + reports

### CRM

- [ ] `leads` (not a separate Opportunity entity)
- [ ] Fields: name, company, contact, email, phone, WhatsApp, source, estimated value, close date, owner, tags, notes, files
- [ ] Pipeline: New, Contacted, Discovery, Qualified, Proposal, Negotiation, Won, Lost
- [ ] Kanban + list + search + filters + owners
- [ ] Convert lead → client (and optional project) without re-entry
- [ ] Deals with agreed split before work (LMS / Fairways pattern)

### Invoices

- [ ] Invoice number sequence per org
- [ ] Items, qty, rate, tax line, discount, terms, due date
- [ ] Statuses: draft, sent, viewed, partially paid, paid, overdue, void
- [ ] **Issue creates charges** (same ledger); draft does not
- [ ] Guard against double recognition with existing project/work-log charges
- [ ] Professional PDF (`@react-pdf/renderer`)
- [ ] Originate from project, milestone, proposal, SOW, or standalone

### Communication (abstractions, no fakes)

- [ ] Email provider interface; Resend (or equivalent) implementation
- [ ] WhatsApp: `wa.me` prefilled fallback; Business API slot later
- [ ] Actions: send proposal, SOW, invoice, payment reminder, milestone/project update
- [ ] In-app notifications
- [ ] Never show “sent” unless a provider actually sent, or the user confirmed the deep link

### Reporting + dashboard + search

- [ ] Dashboard: attention only (unsettled partner payouts, outstanding, overdue, waiting proposals/SOWs, upcoming milestones)
- [ ] Sales: pipeline, won/lost, conversion
- [ ] Projects: active, completed, overdue milestones
- [ ] Financial: invoiced, paid, outstanding, overdue, monthly collections
- [ ] Partners: earned, paid, payable
- [ ] Clients: revenue, outstanding, projects
- [ ] Cmd+K global search (pg_trgm): clients, leads, projects, proposals, SOWs, milestones, invoices, payments, documents
- [ ] Context-aware + Create

**Phase 6 gate:** lead → proposal → SOW → project → invoice → payment is one connected path; each step reusable without the others.

---

## Phase 7 — Portal, automations, polish, seed

### Client portal

- [ ] `share_grants`: hashed token, scoped, revocable, expirable
- [ ] Separate portal layout (premium, mobile-first)
- [ ] Agency chooses exposure: proposal, SOW, project, milestones, files, invoices, pay
- [ ] Never expose internal notes, partner splits, other clients, agency financials
- [ ] Optional pay surface behind payment provider interface (manual status still valid)

### Partner portal

- [ ] Partner role sees assigned projects, own milestones/tasks, own earnings + settlements
- [ ] Cannot see other partners or client-wide financials unless granted

### Automations

- [ ] In-process event bus + outbox if async
- [ ] Events: `work_log.posted`, `lead.created`, `proposal.sent/accepted`, `sow.created/signed`, `project.created`, `milestone.completed`, `invoice.created/overdue`, `payment.posted`, `partner.allocation.created`, `partner.settlement.created`
- [ ] Actions as data: create SOW/project/invoice/task, notify, email, WhatsApp, reminder
- [ ] No automation logic hardcoded in random UI components

### Seed (anonymized; no credentials)

- [ ] USD org, partners Rahul and Sam, default 50/50, fee 5%
- [ ] Hourly retainer (RNPL-like) with Trello URLs
- [ ] Fixed + carry-forward (Your SZN-like) with derived remaining
- [ ] Milestone kickoff (Mulligan-like)
- [ ] 60/40 and 55/45 projects
- [ ] ABC Studio ₹1,00,000 and four partial payments
- [ ] Full lead → proposal → SOW → project path
- [ ] Partner receipt + partial settlement demo

### Quality

- [ ] Desktop + tablet + mobile (portal especially)
- [ ] Keyboard, focus, contrast, semantic HTML, reduced motion
- [ ] Pagination; do not load the whole org into the browser
- [ ] Optimistic UI only where safe (not on money voids)
- [ ] Playwright: portal token cannot see another client; RLS org isolation
- [ ] Empty / loading / error / success on every primary flow

**Phase 7 gate:** north-star questions in this file are all answerable in the UI.

---

## Cross-cutting (every phase)

- [ ] Every new table has `organization_id` + RLS
- [ ] Every Server Function re-checks authz
- [ ] Financial rows: void/reversal, no hard delete
- [ ] Activity event for major verbs (created, sent, viewed, accepted, signed, posted, settled)
- [ ] Optional FKs — no required `proposal_id` / `lead_id` / `invoice_id` to use a module
- [ ] Org switch clears client cache
- [ ] Indexes on list/search paths
- [ ] No floating-point money
- [ ] No fake integrations

---

## Later / out of scope

Do not build these in Phases 0–7. If a request appears, add it here instead of sneaking it into a phase.

- [ ] Full ERP / general ledger / GST filing / GSTR
- [ ] Jira clone (sprints, story points, issue types)
- [ ] WhatsApp Business API inbox / WhatsApp replacement
- [ ] Nested split **storage** (compiler UI only, if ever)
- [ ] Password vault for client credentials
- [ ] FX engine for mixed currencies on one client
- [ ] Accounting integrations (QuickBooks, Tally, Zoho Books)
- [ ] Time tracking as a timesheet product beyond billable work logs
- [ ] Expense tracking / profitability dashboards
- [ ] Recurring retainers / subscriptions as first-class (hourly retainer via work logs is enough)
- [ ] Qualified / third-party e-sign (DocuSign) — provider column is enough until then
- [ ] Stripe/Razorpay live collection (interface in Phase 7; go-live later)
- [ ] AI proposals, summaries, payment follow-ups
- [ ] Worklane’s own SaaS billing

---

## Invariant tests (must stay green)

Keep these as named tests. If one fails, do not ship the phase.

| ID | Invariant |
| --- | --- |
| F1 | `net = gross × (1 - fee_bps/10000)` |
| F2 | `outstanding` is derived; no editable remaining |
| F3 | Monthly opening is not inserted as a charge |
| F4 | Hourly work log must not double-count with a contracted project charge |
| F5 | Partner earned uses **net**, not gross |
| F6 | Partner payable = earned − settled |
| F7 | Client receipt does not mark partners settled |
| F8 | Distribution version change does not rewrite historical allocations |
| F9 | Signed document version cannot mutate |
| F10 | Org A cannot read org B |
| F11 | Portal grant cannot see internal notes or partner splits |
| F12 | Hamilton remainder: partner earned rows sum to the net (or receipt) |

---

## Phase completion log

Record date and PR/commit when a phase gate passes.

| Phase | Date | Proof |
| --- | --- | --- |
| 0 | | |
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | 2026-08-25 | Partners module + migrations applied |
| 5 | 2026-08-25 | Documents TipTap + freeze/sign (structured blocks later) |
| 6 | | |
| 7 | | |
