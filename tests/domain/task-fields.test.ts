import { describe, expect, it } from "vitest";
import {
  cardListFromToolInput,
  planAssigneeIds,
  planTaskChoice,
  planTaskLabels,
} from "@/modules/delivery/task-fields";
import { TASK_KINDS, TASK_PRIORITIES } from "@/modules/delivery/types";

describe("task card fields", () => {
  it("accepts kind and priority from the card form", () => {
    expect(planTaskChoice("Feature", TASK_KINDS, "kind")).toEqual({ value: "feature" });
    expect(planTaskChoice("high", TASK_PRIORITIES, "priority")).toEqual({ value: "high" });
    expect(planTaskChoice("urgent", TASK_PRIORITIES, "priority")).toEqual({
      error: "priority must be low, medium, high",
    });
    expect(planTaskChoice(undefined, TASK_KINDS, "kind")).toEqual({ omit: true });
  });

  it("parses labels from a comma list or an array and clears an empty value", () => {
    expect(planTaskLabels("Design, QA, design")).toEqual({ value: ["Design", "QA"] });
    expect(planTaskLabels(["Launch", "Beta"])).toEqual({ value: ["Launch", "Beta"] });
    expect(planTaskLabels("")).toEqual({ value: [] });
    expect(planTaskLabels(undefined)).toEqual({ omit: true });
    expect(planTaskLabels(Array.from({ length: 13 }, (_, index) => `L${index}`))).toEqual({
      error: "A card can have at most 12 labels",
    });
  });

  it("parses assignee ids and rejects more than eight", () => {
    expect(planAssigneeIds("user-a, user-b, user-a")).toEqual({ value: ["user-a", "user-b"] });
    expect(planAssigneeIds(["user-a"])).toEqual({ value: ["user-a"] });
    expect(planAssigneeIds("")).toEqual({ value: [] });
    expect(planAssigneeIds(Array.from({ length: 9 }, (_, index) => `user-${index}`))).toEqual({
      error: "A card can have at most 8 assignees",
    });
  });

  it("prefers the snake_case MCP name and treats null as clear", () => {
    expect(cardListFromToolInput("Design", "QA")).toBe("Design");
    expect(cardListFromToolInput(undefined, ["QA"])).toEqual(["QA"]);
    expect(cardListFromToolInput(null, "QA")).toBe("");
    expect(cardListFromToolInput(undefined, undefined)).toBeUndefined();
  });
});
