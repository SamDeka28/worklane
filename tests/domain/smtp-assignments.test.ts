import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignmentConflict, chooseSender } from "@/modules/email-senders/assign";
import { canManageSmtp } from "@/modules/identity/permissions";
import { leadMatchesOwner, parseOwnerFilter } from "@/modules/crm/owner-filter";

const me = "user-me";
const sam = "user-sam";

describe("custom smtp assignment", () => {
  it("prefers an assigned mailbox, then a personal lead mailbox, then the studio fallback", () => {
    const assigned = [{ id: "box-a", name: "Sales", modules: ["crm"], memberIds: [me] }];
    expect(
      chooseSender({ module: "crm", userId: me, ownMailbox: true, assigned, hasPersonal: true, hasFallback: true }),
    ).toEqual({ kind: "assigned", id: "box-a" });
    expect(
      chooseSender({ module: "documents", userId: me, ownMailbox: true, assigned, hasPersonal: true, hasFallback: true }),
    ).toEqual({ kind: "fallback" });
    expect(
      chooseSender({ module: "crm", userId: sam, ownMailbox: true, assigned, hasPersonal: true, hasFallback: true }),
    ).toEqual({ kind: "personal" });
    expect(
      chooseSender({ module: "finance", userId: sam, ownMailbox: true, assigned, hasPersonal: true, hasFallback: true }),
    ).toEqual({ kind: "fallback" });
    expect(
      chooseSender({ module: "finance", userId: sam, ownMailbox: false, assigned: [], hasPersonal: false, hasFallback: false }),
    ).toBeNull();
  });

  it("rejects a second mailbox for the same person and module", () => {
    const existing = [{ id: "box-a", name: "Sales", modules: ["crm", "documents"], memberIds: [me] }];
    expect(assignmentConflict(existing, { modules: ["crm"], memberIds: [me] })).toBe("Sales");
    expect(assignmentConflict(existing, { id: "box-a", modules: ["crm"], memberIds: [me] })).toBeNull();
    expect(assignmentConflict(existing, { modules: ["finance"], memberIds: [me] })).toBeNull();
    expect(assignmentConflict(existing, { modules: ["crm"], memberIds: [sam] })).toBeNull();
  });

  it("lets owners, admins, and granted members manage custom smtp", () => {
    expect(canManageSmtp({ role: "owner", permissions: {} })).toBe(true);
    expect(canManageSmtp({ role: "admin", permissions: {} })).toBe(true);
    expect(canManageSmtp({ role: "member", permissions: { smtp: { access: "write" } } })).toBe(true);
    expect(canManageSmtp({ role: "member", permissions: {} })).toBe(false);
    expect(canManageSmtp({ role: "viewer", permissions: { smtp: { access: "write" } } })).toBe(false);
  });

  it("passes the resolved mailbox through invoice and timesheet sends", () => {
    const invoice = readFileSync("src/modules/invoices/actions.ts", "utf8");
    const timesheet = readFileSync("src/modules/delivery/timesheet-send.ts", "utf8");
    expect(invoice).toContain('module: "finance"');
    expect(invoice).toContain("smtp: sender.smtp");
    expect(timesheet).toContain('module: "delivery"');
    expect(timesheet).toContain("smtp: sender.smtp");
  });
});

describe("lead owner filter", () => {
  it("keeps me and a single owner id working, and matches any selected person", () => {
    expect(parseOwnerFilter("me", me)).toEqual({ ids: [me], unassigned: false });
    expect(parseOwnerFilter(sam, me)).toEqual({ ids: [sam], unassigned: false });
    expect(parseOwnerFilter(`${me},none`, me)).toEqual({ ids: [me], unassigned: true });
    expect(leadMatchesOwner(null, { ids: [], unassigned: false })).toBe(true);
    expect(leadMatchesOwner(me, { ids: [me, sam], unassigned: false })).toBe(true);
    expect(leadMatchesOwner(null, { ids: [sam], unassigned: true })).toBe(true);
    expect(leadMatchesOwner("other", { ids: [me], unassigned: true })).toBe(false);
  });
});
