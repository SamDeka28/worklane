import { describe, expect, it } from "vitest";
import {
  assertCanMutateVersion,
  buildLiveSnapshot,
  isVersionLocked,
} from "@/modules/documents/lock";

describe("documents lock", () => {
  it("F9 locks signed versions", () => {
    expect(isVersionLocked("signed", "2026-01-01")).toBe(true);
    expect(isVersionLocked("draft", null)).toBe(false);
    expect(() =>
      assertCanMutateVersion({ status: "signed", lockedAt: new Date().toISOString() }),
    ).toThrow(/cannot be edited/);
  });

  it("snapshot freezes content independently of later live edits", () => {
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    const snapshot = buildLiveSnapshot({
      clientName: "Vince",
      projectName: "Kickoff",
      contentDoc: content,
      frozenAt: "2026-08-01T00:00:00.000Z",
    });
    const mutated = { ...content, mutated: true };
    expect(snapshot.contentDoc).toEqual(content);
    expect(snapshot.contentDoc).not.toEqual(mutated);
  });
});
