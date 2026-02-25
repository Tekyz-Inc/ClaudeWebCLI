import { describe, it, expect } from "vitest";
import { parseDiff } from "./DiffView.js";

describe("parseDiff", () => {
  it("parses a simple hunk with one removal and one addition", () => {
    const diff = `@@ -1,3 +1,3 @@
 context before
-removed line
+added line
 context after`;
    const rows = parseDiff(diff);
    expect(rows[0].isHeader).toBe(true);
    expect(rows[1].left?.type).toBe("context");
    expect(rows[1].right?.type).toBe("context");
    expect(rows[2].left?.type).toBe("removed");
    expect(rows[2].left?.content).toBe("removed line");
    expect(rows[2].right?.type).toBe("added");
    expect(rows[2].right?.content).toBe("added line");
    expect(rows[3].left?.type).toBe("context");
  });

  it("handles more removals than additions — right side is null for extras", () => {
    const diff = `@@ -1,3 +1,1 @@
-line 1
-line 2
-line 3
+line 1`;
    const rows = parseDiff(diff);
    expect(rows[1].left?.type).toBe("removed");
    expect(rows[1].right?.type).toBe("added");
    expect(rows[2].left?.type).toBe("removed");
    expect(rows[2].right).toBeNull();
    expect(rows[3].left?.type).toBe("removed");
    expect(rows[3].right).toBeNull();
  });

  it("handles more additions than removals — left side is null for extras", () => {
    const diff = `@@ -1,1 +1,3 @@
-old line
+new line 1
+new line 2
+new line 3`;
    const rows = parseDiff(diff);
    expect(rows[1].left?.type).toBe("removed");
    expect(rows[1].right?.type).toBe("added");
    expect(rows[2].left).toBeNull();
    expect(rows[2].right?.type).toBe("added");
    expect(rows[3].left).toBeNull();
    expect(rows[3].right?.type).toBe("added");
  });

  it("skips diff/index/---/+++ header lines", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
 context
-old
+new`;
    const rows = parseDiff(diff);
    expect(rows[0].isHeader).toBe(true);
    expect(rows[0].headerText).toContain("@@");
    expect(rows[1].left?.type).toBe("context");
  });

  it("tracks line numbers correctly starting from hunk header offsets", () => {
    const diff = `@@ -5,3 +5,3 @@
 context
-removed
+added
 context`;
    const rows = parseDiff(diff);
    expect(rows[1].left?.num).toBe(5);
    expect(rows[1].right?.num).toBe(5);
    expect(rows[2].left?.num).toBe(6);
    expect(rows[2].right?.num).toBe(6);
    expect(rows[3].left?.num).toBe(7);
    expect(rows[3].right?.num).toBe(7);
  });

  it("returns empty array for empty diff string", () => {
    expect(parseDiff("")).toEqual([]);
  });
});
