import { describe, expect, it } from "vitest";
import {
  defaultBoardColumns,
  parseBoardSettings,
  planColumnSync,
  validateBoardColumns,
  type ProjectColumnLink,
} from "@/modules/delivery/board-columns";

const existing: ProjectColumnLink[] = [
  { id: "col-todo", name: "To do", position: 0, systemKey: "todo", studioColumnId: null },
  { id: "col-doing", name: "Doing", position: 1, systemKey: "doing", studioColumnId: null },
  { id: "col-done", name: "Done", position: 2, systemKey: "done", studioColumnId: null },
  { id: "col-review", name: "Review", position: 3, systemKey: null, studioColumnId: null },
];

describe("studio board columns", () => {
  it("starts from To do, Doing, and Done until an admin shares a set", () => {
    expect(parseBoardSettings(null)).toEqual({ shared: false, columns: defaultBoardColumns() });
    expect(parseBoardSettings({ board: { shared: true } })).toMatchObject({ shared: false });
  });

  it("keeps a shared set that still has one list for each status", () => {
    const columns = [
      ...defaultBoardColumns(),
      { id: "review", name: "Review", position: 3, systemKey: null },
    ];
    expect(validateBoardColumns(columns)).toEqual({ columns });
    expect(parseBoardSettings({ board: { shared: true, columns } })).toEqual({ shared: true, columns });
  });

  it("rejects a set that drops a status list or repeats a name", () => {
    expect(validateBoardColumns(defaultBoardColumns().filter((column) => column.systemKey !== "done"))).toEqual({
      error: "Keep one To do, one Doing, and one Done list. Names have to be unique.",
    });
    expect(
      validateBoardColumns(
        defaultBoardColumns().map((column) => ({ ...column, name: "List" })),
      ),
    ).toMatchObject({ error: expect.any(String) });
  });

  it("links a project's status lists and removes a list that is not in the studio set", () => {
    const plan = planColumnSync(existing, [
      { id: "todo", name: "Backlog", position: 0, systemKey: "todo" },
      { id: "review", name: "Review", position: 1, systemKey: null },
      { id: "doing", name: "Doing", position: 2, systemKey: "doing" },
      { id: "done", name: "Done", position: 3, systemKey: "done" },
    ]);
    expect(plan.update).toEqual([
      { id: "col-todo", name: "Backlog", position: 0, systemKey: "todo", studioColumnId: "todo" },
      { id: "col-doing", name: "Doing", position: 2, systemKey: "doing", studioColumnId: "doing" },
      { id: "col-done", name: "Done", position: 3, systemKey: "done", studioColumnId: "done" },
    ]);
    expect(plan.insert).toEqual([
      { name: "Review", position: 1, systemKey: null, studioColumnId: "review" },
    ]);
    expect(plan.remove).toEqual([{ id: "col-review", moveTasksToId: "col-todo" }]);
  });
});
