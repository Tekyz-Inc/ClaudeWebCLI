// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock CodeMirror — heavy in jsdom
vi.mock("@uiw/react-codemirror", () => ({
  __esModule: true,
  default: (props: { value?: string }) => (
    <div data-testid="codemirror">{props.value}</div>
  ),
}));

vi.mock("@codemirror/view", () => ({
  EditorView: { theme: () => [] },
}));

vi.mock("@codemirror/theme-one-dark", () => ({
  oneDark: [],
}));

vi.mock("@codemirror/lang-javascript", () => ({ javascript: () => [] }));
vi.mock("@codemirror/lang-python", () => ({ python: () => [] }));
vi.mock("@codemirror/lang-json", () => ({ json: () => [] }));
vi.mock("@codemirror/lang-html", () => ({ html: () => [] }));
vi.mock("@codemirror/lang-css", () => ({ css: () => [] }));
vi.mock("@codemirror/lang-markdown", () => ({ markdown: () => [] }));

const mockApi = {
  getFileTree: vi.fn().mockResolvedValue({ tree: [] }),
  readFile: vi.fn().mockResolvedValue({ content: "file content" }),
  writeFile: vi.fn().mockResolvedValue({ ok: true }),
  getFileDiff: vi.fn().mockResolvedValue({ path: "/repo/file.ts", diff: "" }),
};

vi.mock("../api.js", () => ({
  api: {
    getFileTree: (...args: unknown[]) => mockApi.getFileTree(...args),
    readFile: (...args: unknown[]) => mockApi.readFile(...args),
    writeFile: (...args: unknown[]) => mockApi.writeFile(...args),
    getFileDiff: (...args: unknown[]) => mockApi.getFileDiff(...args),
  },
}));

// ─── Store mock ─────────────────────────────────────────────────────────────

interface MockStoreState {
  darkMode: boolean;
  sessions: Map<string, { cwd?: string }>;
  sdkSessions: { sessionId: string; cwd?: string }[];
  editorOpenFile: Map<string, string>;
  changedFiles: Map<string, Set<string>>;
  setEditorOpenFile: ReturnType<typeof vi.fn>;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    darkMode: false,
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sdkSessions: [],
    editorOpenFile: new Map(),
    changedFiles: new Map(),
    setEditorOpenFile: vi.fn(),
    ...overrides,
  };
}

vi.mock("../store.js", () => ({
  useStore: (selector: (s: MockStoreState) => unknown) => selector(storeState),
}));

import { EditorPanel } from "./EditorPanel.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("EditorPanel", () => {
  it("shows placeholder when no file is selected", () => {
    render(<EditorPanel sessionId="s1" />);
    expect(screen.getByText("Select a file to edit")).toBeInTheDocument();
  });

  it("renders CodeMirror when a file is selected", async () => {
    resetStore({
      editorOpenFile: new Map([["s1", "/repo/file.ts"]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    });
    expect(mockApi.readFile).toHaveBeenCalledWith("/repo/file.ts");
  });

  it("does not show Edit/Diff toggle for unchanged files", async () => {
    resetStore({
      editorOpenFile: new Map([["s1", "/repo/file.ts"]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    });
    expect(screen.queryByText("Diff")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("shows Edit/Diff toggle for changed files", async () => {
    resetStore({
      editorOpenFile: new Map([["s1", "/repo/file.ts"]]),
      changedFiles: new Map([["s1", new Set(["/repo/file.ts"])]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    });
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Diff")).toBeInTheDocument();
  });

  it("switches to diff view and fetches diff when Diff button is clicked", async () => {
    // Use .txt extension to avoid hljs syntax highlighting wrapping content in spans
    const diffOutput = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;

    mockApi.getFileDiff.mockResolvedValueOnce({ path: "/repo/file.txt", diff: diffOutput });

    resetStore({
      editorOpenFile: new Map([["s1", "/repo/file.txt"]]),
      changedFiles: new Map([["s1", new Set(["/repo/file.txt"])]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Diff"));

    await waitFor(() => {
      expect(mockApi.getFileDiff).toHaveBeenCalledWith("/repo/file.txt");
    });

    // Diff lines should be rendered (side-by-side format renders content as plain text for .txt)
    await waitFor(() => {
      expect(screen.getByText("old line")).toBeInTheDocument();
      expect(screen.getByText("new line")).toBeInTheDocument();
    });

    // CodeMirror should not be visible
    expect(screen.queryByTestId("codemirror")).not.toBeInTheDocument();
  });

  it("switches back to editor when Edit button is clicked", async () => {
    mockApi.getFileDiff.mockResolvedValueOnce({ path: "/repo/file.ts", diff: "+added" });

    resetStore({
      editorOpenFile: new Map([["s1", "/repo/file.ts"]]),
      changedFiles: new Map([["s1", new Set(["/repo/file.ts"])]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
    });

    // Switch to diff
    fireEvent.click(screen.getByText("Diff"));
    await waitFor(() => {
      expect(screen.getByText("added")).toBeInTheDocument();
    });

    // Switch back to edit
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    });
  });

  it("shows 'No changes' when diff is empty", async () => {
    mockApi.getFileDiff.mockResolvedValueOnce({ path: "/repo/file.ts", diff: "" });

    resetStore({
      editorOpenFile: new Map([["s1", "/repo/file.ts"]]),
      changedFiles: new Map([["s1", new Set(["/repo/file.ts"])]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Diff"));

    await waitFor(() => {
      expect(screen.getByText("No changes")).toBeInTheDocument();
    });
  });

  it("renders diff lines with correct color classes", async () => {
    // Use .txt extension to avoid hljs syntax highlighting
    const diffOutput = `diff --git a/f.txt b/f.txt
--- a/f.txt
+++ b/f.txt
@@ -1,2 +1,2 @@
 context
-removed
+added`;

    mockApi.getFileDiff.mockResolvedValueOnce({ path: "/repo/f.txt", diff: diffOutput });

    resetStore({
      editorOpenFile: new Map([["s1", "/repo/f.txt"]]),
      changedFiles: new Map([["s1", new Set(["/repo/f.txt"])]]),
    });

    render(<EditorPanel sessionId="s1" />);

    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Diff"));

    await waitFor(() => {
      expect(screen.getByText("removed")).toBeInTheDocument();
    });

    // DiffView side-by-side format: removed lines have bg-red-950/40 on the parent <td>
    const removedEl = screen.getByText("removed");
    const removedTd = removedEl.closest("td");
    expect(removedTd?.className).toContain("bg-red-950/40");

    // Added lines have bg-green-950/40 on the parent <td>
    const addedEl = screen.getByText("added");
    const addedTd = addedEl.closest("td");
    expect(addedTd?.className).toContain("bg-green-950/40");

    // Hunk header <td> has text-cc-primary class
    const hunkHeader = screen.getByText("@@ -1,2 +1,2 @@");
    expect(hunkHeader).toHaveClass("text-cc-primary");

    // Context lines appear in both left and right columns
    const contextEls = screen.getAllByText("context");
    expect(contextEls.length).toBeGreaterThan(0);
  });

  it("displays Changed Files section when files are modified", () => {
    resetStore({
      changedFiles: new Map([["s1", new Set(["/repo/src/app.ts"])]]),
    });

    render(<EditorPanel sessionId="s1" />);

    expect(screen.getByText("Changed (1)")).toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });
});
