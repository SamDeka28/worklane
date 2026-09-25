import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  BoardProductFrame,
  FinanceProductFrame,
  LeadsProductFrame,
  ProjectsProductFrame,
} from "@/components/marketing/product-frames";
import { Button } from "@/components/ui/button";

const LANE = [
  {
    step: "01",
    title: "Lead",
    body: "A conversation becomes an opportunity on your journey — stages you shape, not a fixed funnel.",
  },
  {
    step: "02",
    title: "Client",
    body: "Won leads become clients with contacts, projects, and history already attached.",
  },
  {
    step: "03",
    title: "Project & Board",
    body: "Delivery lives on the project and rolls up to Studio Board so open work never hides in a tab.",
  },
  {
    step: "04",
    title: "Money",
    body: "Bill milestones, record what lands, and keep outstanding on the same books as the work.",
  },
] as const;

const FEATURES = [
  {
    id: "leads",
    number: "01",
    kicker: "Sell",
    title: "Lead journey that becomes a client",
    body: "Build the stages your studio actually uses — discovery, proposal, whatever you name them. Drag cards through the pipeline. When you win, Worklane creates the client from the lead so you never retype the company, contact, or deal value.",
    Frame: LeadsProductFrame,
  },
  {
    id: "projects",
    number: "02",
    kicker: "Deliver",
    title: "Projects that stay tied to who pays",
    body: "Every active engagement shows status, client, and what to do next. Open the board, log hours, bill a milestone — delivery never drifts away from the client record that owns the money.",
    Frame: ProjectsProductFrame,
  },
  {
    id: "finance",
    number: "03",
    kicker: "Collect",
    title: "Finance that follows the work",
    body: "Collect what’s due, see what’s ready to bill, record receipts, and read the month in one ledger. Outstanding isn’t a leftover spreadsheet column — it’s attached to the same projects your team is shipping.",
    Frame: FinanceProductFrame,
  },
] as const;

const COMPARE = [
  {
    stack: "A CRM for pipeline, a board for tasks, a sheet for invoices",
    worklane: "One studio record from lead to settled payment",
  },
  {
    stack: "Copy the client into three tools and hope they stay in sync",
    worklane: "Win a lead → client → project carries the same people and dollars",
  },
  {
    stack: "Money living in a private spreadsheet only the owner opens",
    worklane: "Finance on the books — with access so Progress teammates never see it",
  },
] as const;

const FAQ = [
  {
    q: "Who is Worklane for?",
    a: "Studios and small teams that sell creative or software work, deliver with collaborators, and need the money trail to stay attached to the work — not bolted on afterward.",
  },
  {
    q: "Do I need every module on day one?",
    a: "No. Enable what your studio uses. Invite with Full, Progress, Partner, or Custom access so someone without Finance never sees outstanding, pipeline dollars, or charge actions.",
  },
  {
    q: "How is Studio Board different from a project board?",
    a: "Each project has its own board. Studio Board rolls every open card from active projects into one kanban — priority, kind, project chip, due date — so nothing hides behind a project tab.",
  },
  {
    q: "Where can I learn how everything works?",
    a: "The Worklane docs cover every module with step-by-step how-tos, in-depth guides, and reference — from converting your first lead to settling partner payouts. Find them under Docs in the menu.",
  },
  {
    q: "What does it cost?",
    a: "Start free. Create an account, open your studio, and run the lane. No invented price table — explore as you go.",
  },
] as const;

function FrameGlow({ children }: { children: React.ReactNode }) {
  return (
    <div className="lane-mkt-glow relative">
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-70 blur-2xl sm:-inset-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, oklch(0.48 0.18 275 / 0.45), transparent 70%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default function MarketingHomePage() {
  return (
    <main>
      {/* Hero — brand + copy + Board as one composition */}
      <section className="relative isolate min-h-svh overflow-hidden">
        <Image
          src="/brand/worklane-hero-mesh.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,#05070Fe6_0%,#05070F99_22%,#05070F66_42%,#05070Ff2_78%,#05070F_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 55% 45% at 70% 18%, oklch(0.52 0.2 275 / 0.42), transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto flex min-h-svh max-w-[90rem] flex-col px-5 pt-24 sm:px-8 sm:pt-28 lg:px-12">
          <div className="lane-marketing-hero mx-auto w-full max-w-4xl pt-6 text-center sm:pt-10">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <BrandMark size={44} priority className="brightness-110 sm:hidden" />
              <BrandMark
                size={56}
                priority
                className="hidden brightness-110 sm:block lg:hidden"
              />
              <BrandMark
                size={64}
                priority
                className="hidden brightness-110 lg:block"
              />
              <h1 className="font-heading text-[clamp(3rem,9vw,6.75rem)] font-extrabold leading-[0.86] tracking-[-0.05em] text-white">
                Worklane
              </h1>
            </div>
            <p className="mx-auto mt-7 max-w-2xl text-[clamp(1.2rem,2.8vw,1.85rem)] font-medium leading-[1.25] tracking-[-0.025em] text-white/90">
              The studio operating system — from first conversation to final
              payment.
            </p>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-white/50 sm:text-base sm:leading-7">
              Sell the work on a lead journey, deliver it on projects and Studio
              Board, collect on the same books. One continuous lane instead of a
              CRM, a board, and a spreadsheet fighting each other.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="h-12 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground hover:brightness-110"
                nativeButton={false}
                render={<Link href="/signup" />}
              >
                Start free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/15 bg-white/4 px-7 text-[15px] text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
                nativeButton={false}
                render={<Link href="#board" />}
              >
                See the Board
              </Button>
            </div>
          </div>

          <div
            id="board"
            className="lane-mkt-product relative mt-12 w-full flex-1 scroll-mt-28 sm:mt-14"
          >
            <div
              className="pointer-events-none absolute -inset-x-4 -top-8 bottom-0 opacity-80 blur-3xl sm:-inset-x-10"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 70% 55% at 50% 30%, oklch(0.48 0.18 275 / 0.5), transparent 72%)",
              }}
            />
            <div className="relative mx-auto max-w-[90rem] translate-y-2 sm:translate-y-4">
              <BoardProductFrame className="shadow-[0_-20px_80px_-20px_rgba(0,0,0,0.55)]" />
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-[#05070F] to-transparent sm:h-32"
              aria-hidden
            />
          </div>
        </div>
      </section>

      {/* Board story — continues the hero visual */}
      <section
        id="product"
        className="scroll-mt-24 px-5 pt-6 pb-8 sm:px-8 sm:pt-10 lg:px-12"
      >
        <div className="mx-auto flex max-w-[90rem] flex-col gap-6 border-b border-white/8 pb-16 sm:pb-20 lg:flex-row lg:items-end lg:justify-between lg:gap-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              Studio Board
            </p>
            <h2 className="mt-3 font-heading text-[clamp(1.85rem,3.8vw,3rem)] font-bold leading-[1.08] tracking-[-0.035em]">
              Every open card across active projects — one kanban your whole
              studio can trust.
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-7 text-white/48 lg:pb-1 lg:text-right">
            Priority, kind, project chip, and due date travel with the card.
            Drag work without hopping project pages. Project boards stay
            local; Studio Board is the lane above them.
          </p>
        </div>
      </section>

      {/* Major modules */}
      <section
        id="modules"
        className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
      >
        <div className="mx-auto max-w-[90rem]">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              Major modules
            </p>
            <h2 className="mt-3 font-heading text-[clamp(2rem,4.2vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.035em]">
              Sell. Deliver. Collect — still one studio.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/48">
              Leads, projects, and finance aren’t separate products bolted
              together. They’re surfaces on the same record so the deal you
              won is the client you deliver for and the invoice you collect.
            </p>
          </div>

          <div className="mt-16 space-y-24 md:mt-24 md:space-y-32">
            {FEATURES.map((feature, index) => {
              const flip = index % 2 === 1;
              return (
                <article
                  key={feature.id}
                  id={feature.id}
                  className="scroll-mt-28 grid items-center gap-10 lg:grid-cols-12 lg:gap-12"
                >
                  <div
                    className={
                      flip
                        ? "lg:col-span-4 lg:col-start-9 lg:row-start-1"
                        : "lg:col-span-4"
                    }
                  >
                    <span className="font-heading text-5xl font-bold tracking-tight text-white/10 sm:text-6xl">
                      {feature.number}
                    </span>
                    <p className="-mt-2 text-[11px] font-semibold tracking-[0.2em] text-violet-300/55 uppercase">
                      {feature.kicker}
                    </p>
                    <h3 className="mt-3 font-heading text-[clamp(1.65rem,2.8vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.03em] text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-4 max-w-sm text-[15px] leading-7 text-white/48">
                      {feature.body}
                    </p>
                  </div>
                  <div
                    className={
                      flip
                        ? "lg:col-span-8 lg:col-start-1 lg:row-start-1"
                        : "lg:col-span-8"
                    }
                  >
                    <FrameGlow>
                      <feature.Frame />
                    </FrameGlow>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="lane"
        className="scroll-mt-24 relative overflow-hidden border-y border-white/8 bg-shell px-5 py-24 sm:px-8 sm:py-28 lg:px-12"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 40% 50% at 10% 50%, oklch(0.45 0.16 275 / 0.28), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-[90rem]">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              How it works
            </p>
            <h2 className="mt-3 font-heading text-[clamp(2rem,4.2vw,3.1rem)] font-bold leading-[1.05] tracking-[-0.035em]">
              Four stages. Zero retyping.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/48">
              The record carries forward. Win the lead, open the project, bill
              the milestone — you’re updating one studio, not copying between
              tools.
            </p>
          </div>
          <ol className="mt-14 grid gap-0 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
            {LANE.map((item) => (
              <li
                key={item.step}
                className="relative border-t border-white/10 py-8 pr-6 lg:border-t-0 lg:border-l lg:py-0 lg:pl-8 lg:first:border-l-0 lg:first:pl-0"
              >
                <span className="text-[11px] font-semibold tracking-[0.18em] text-violet-300/50">
                  {item.step}
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-[16rem] text-[14px] leading-6 text-white/45">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Compare + Access */}
      <section className="px-5 py-24 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-[90rem] gap-20 lg:grid-cols-2 lg:gap-24">
          <div id="compare" className="scroll-mt-28">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              Vs the stack
            </p>
            <h2 className="mt-3 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.03em]">
              Built for the studio that outgrew duct tape.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-white/45">
              Most teams stitch a CRM, a project board, and a spreadsheet. Worklane
              keeps the lane intact so delivery and money never drift apart.
            </p>
            <ul className="mt-10 space-y-0 divide-y divide-white/10 border-y border-white/10">
              {COMPARE.map((row) => (
                <li key={row.stack} className="grid gap-3 py-6 sm:grid-cols-2 sm:gap-8">
                  <p className="text-[14px] leading-6 text-white/35">{row.stack}</p>
                  <p className="text-[14px] font-medium leading-6 text-white/85">
                    {row.worklane}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              Access
            </p>
            <h2 className="mt-3 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.03em]">
              Progress-only teammates never see the money.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-white/45">
              Invite with the right lens from day one. Finance off means no
              outstanding, no pipeline dollars, no charge actions — across Home,
              Clients, Projects, and CRM.
            </p>
            <ul className="mt-10 space-y-0 divide-y divide-white/10 border-y border-white/10">
              {[
                {
                  title: "Full",
                  body: "Edit leads, board, finance, partners — the whole studio.",
                },
                {
                  title: "Progress",
                  body: "Projects and docs. Charges and Split tabs stay hidden.",
                },
                {
                  title: "Partner",
                  body: "Read delivery and partner balances — not the client ledger.",
                },
                {
                  title: "Custom",
                  body: "Pick Off / View / Edit per module and which project tabs show.",
                },
              ].map((row) => (
                <li
                  key={row.title}
                  className="grid gap-1 py-5 sm:grid-cols-[6.5rem_1fr] sm:gap-6"
                >
                  <p className="text-sm font-semibold text-white">{row.title}</p>
                  <p className="text-[14px] leading-6 text-white/45">{row.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Who */}
      <section className="border-t border-white/8 bg-shell px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <p className="max-w-3xl font-heading text-[clamp(1.5rem,3.2vw,2.35rem)] font-semibold leading-[1.28] tracking-[-0.025em] text-white/90">
            Built for studios that share the work — freelancers, partners, and
            teams who need the lane more than another dashboard.
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                title: "Boutique studios",
                body: "Pipeline, delivery board, and collections in one place — so the person closing the deal isn’t hunting three tabs for status.",
              },
              {
                title: "Partner-heavy crews",
                body: "Collaborators get Progress or Partner access. Splits and settlements stay internal and tied to the project work.",
              },
              {
                title: "Owner–operators",
                body: "Invite with the right access so money stays with who should see it, without building a second set of books.",
              },
            ].map((item) => (
              <div key={item.title} className="border-t border-white/10 pt-5">
                <h3 className="text-base font-semibold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-6 text-white/45">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get started */}
      <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[90rem]">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              Get started
            </p>
            <h2 className="mt-3 font-heading text-[clamp(1.85rem,3.5vw,2.75rem)] font-bold tracking-[-0.03em]">
              Three steps onto the lane.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-white/45">
              Every step is covered in the{" "}
              <Link
                href="/docs/quick-start"
                className="font-medium text-violet-300 underline decoration-violet-300/30 underline-offset-4 hover:text-violet-200"
              >
                quick start guide
              </Link>{" "}
              — plus in-depth how-tos for each module in the{" "}
              <Link
                href="/docs"
                className="font-medium text-violet-300 underline decoration-violet-300/30 underline-offset-4 hover:text-violet-200"
              >
                documentation
              </Link>
              .
            </p>
          </div>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              {
                step: "01",
                title: "Create your studio",
                body: "Sign up, name the studio, and land on Home with leads, projects, board, and finance ready to turn on.",
              },
              {
                step: "02",
                title: "Invite the team",
                body: "Full, Progress, Partner, or Custom — money stays with the people who should see it.",
              },
              {
                step: "03",
                title: "Run the lane",
                body: "Capture a lead, open the board, bill the work. One continuous record from conversation to payment.",
              },
            ].map((item) => (
              <li key={item.step}>
                <span className="text-[11px] font-semibold tracking-[0.18em] text-violet-300/50">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-xs text-[14px] leading-6 text-white/45">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-24 border-t border-white/8 px-5 py-24 sm:px-8 sm:py-28 lg:px-12"
      >
        <div className="mx-auto max-w-[90rem]">
          <h2 className="font-heading text-[clamp(1.85rem,3.5vw,2.75rem)] font-bold tracking-[-0.03em]">
            Questions
          </h2>
          <dl className="mt-10 max-w-4xl divide-y divide-white/10 border-y border-white/10">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="grid gap-3 py-8 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-12"
              >
                <dt className="text-[15px] font-semibold tracking-tight text-white">
                  {item.q}
                </dt>
                <dd className="text-[15px] leading-7 text-white/45">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 55% 45% at 50% 100%, oklch(0.48 0.2 275 / 0.55), transparent 70%)",
          }}
        />
        <div className="lane-mkt-cta relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] ring-1 ring-white/12 sm:rounded-[2.5rem]">
          <div className="absolute inset-0 bg-shell" />
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 70% at 85% 20%, oklch(0.5 0.18 275 / 0.35), transparent 60%)",
            }}
          />
          <div className="relative grid gap-10 px-8 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16 lg:px-16 lg:py-24">
            <div>
              <BrandMark size={44} className="brightness-110" />
              <h2 className="mt-8 font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.04em]">
                Open your studio.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-7 text-white/48">
                Create an account, invite the team, and put every deal on the
                lane — leads, board, and finance that stay connected from first
                conversation to final payment.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button
                size="lg"
                className="h-12 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground hover:brightness-110"
                nativeButton={false}
                render={<Link href="/signup" />}
              >
                Create account
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/20 bg-transparent px-7 text-[15px] text-white hover:bg-white/8 hover:text-white"
                nativeButton={false}
                render={<Link href="/onboarding" />}
              >
                Enter Worklane
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
