// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolBlock, ToolIcon } from "./ToolBlock.js";
import { getToolIcon, getToolLabel, getPreview } from "./tool-utils.js";

// ToolBlock uses useStore for chatExpanded/chatExpandTick
vi.mock("../store.js", () => ({
  useStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ chatExpanded: true, chatExpandTick: 0 }),
}));

// ─── getToolIcon ─────────────────────────────────────────────────────────────

describe("getToolIcon", () => {
  it("returns 'terminal' for Bash", () => {
    expect(getToolIcon("Bash")).toBe("terminal");
  });

  it("returns 'file' for Read", () => {
    expect(getToolIcon("Read")).toBe("file");
  });

  it("returns 'file-plus' for Write", () => {
    expect(getToolIcon("Write")).toBe("file-plus");
  });

  it("returns 'file-edit' for Edit", () => {
    expect(getToolIcon("Edit")).toBe("file-edit");
  });

  it("returns 'search' for Glob", () => {
    expect(getToolIcon("Glob")).toBe("search");
  });

  it("returns 'search' for Grep", () => {
    expect(getToolIcon("Grep")).toBe("search");
  });

  it("returns 'globe' for WebFetch", () => {
    expect(getToolIcon("WebFetch")).toBe("globe");
  });

  it("returns 'globe' for WebSearch", () => {
    expect(getToolIcon("WebSearch")).toBe("globe");
  });

  it("returns 'list' for TaskCreate", () => {
    expect(getToolIcon("TaskCreate")).toBe("list");
  });

  it("returns 'message' for SendMessage", () => {
    expect(getToolIcon("SendMessage")).toBe("message");
  });

  it("returns 'tool' for unknown tool names", () => {
    expect(getToolIcon("SomeUnknownTool")).toBe("tool");
    expect(getToolIcon("")).toBe("tool");
    expect(getToolIcon("FooBar")).toBe("tool");
  });
});

// ─── getToolLabel ────────────────────────────────────────────────────────────

describe("getToolLabel", () => {
  it("returns 'Terminal' for Bash", () => {
    expect(getToolLabel("Bash")).toBe("Terminal");
  });

  it("returns 'Read File' for Read", () => {
    expect(getToolLabel("Read")).toBe("Read File");
  });

  it("returns 'Write File' for Write", () => {
    expect(getToolLabel("Write")).toBe("Write File");
  });

  it("returns 'Edit File' for Edit", () => {
    expect(getToolLabel("Edit")).toBe("Edit File");
  });

  it("returns 'Find Files' for Glob", () => {
    expect(getToolLabel("Glob")).toBe("Find Files");
  });

  it("returns 'Search Content' for Grep", () => {
    expect(getToolLabel("Grep")).toBe("Search Content");
  });

  it("returns the name itself for unknown tools", () => {
    expect(getToolLabel("WebFetch")).toBe("WebFetch");
    expect(getToolLabel("SomeUnknownTool")).toBe("SomeUnknownTool");
    expect(getToolLabel("CustomTool")).toBe("CustomTool");
  });
});

// ─── getPreview ──────────────────────────────────────────────────────────────

describe("getPreview", () => {
  it("extracts command for Bash tools", () => {
    expect(getPreview("Bash", { command: "ls -la" })).toBe("ls -la");
  });

  it("truncates Bash commands longer than 60 chars", () => {
    const longCommand = "a".repeat(80);
    const result = getPreview("Bash", { command: longCommand });
    expect(result).toBe("a".repeat(60) + "...");
    expect(result.length).toBe(63);
  });

  it("does not truncate Bash commands at exactly 60 chars", () => {
    const exactCommand = "b".repeat(60);
    expect(getPreview("Bash", { command: exactCommand })).toBe(exactCommand);
  });

  it("extracts last 2 path segments for Read", () => {
    expect(getPreview("Read", { file_path: "/home/user/project/src/index.ts" })).toBe("src/index.ts");
  });

  it("extracts last 2 path segments for Write", () => {
    expect(getPreview("Write", { file_path: "/var/log/app.log" })).toBe("log/app.log");
  });

  it("extracts last 2 path segments for Edit", () => {
    expect(getPreview("Edit", { file_path: "/a/b/c/d.txt" })).toBe("c/d.txt");
  });

  it("handles short paths for file tools", () => {
    expect(getPreview("Read", { file_path: "file.txt" })).toBe("file.txt");
  });

  it("extracts pattern for Glob", () => {
    expect(getPreview("Glob", { pattern: "**/*.ts" })).toBe("**/*.ts");
  });

  it("extracts pattern for Grep", () => {
    expect(getPreview("Grep", { pattern: "TODO|FIXME" })).toBe("TODO|FIXME");
  });

  it("extracts query for WebSearch", () => {
    expect(getPreview("WebSearch", { query: "react testing library" })).toBe("react testing library");
  });

  it("returns empty string for unknown tools", () => {
    expect(getPreview("UnknownTool", { some: "data" })).toBe("");
  });

  it("returns empty string for Bash without command", () => {
    expect(getPreview("Bash", { description: "something" })).toBe("");
  });

  it("returns empty string for Read without file_path", () => {
    expect(getPreview("Read", { content: "data" })).toBe("");
  });
});

// ─── ToolIcon ────────────────────────────────────────────────────────────────

describe("ToolIcon", () => {
  it("renders an SVG for terminal type", () => {
    const { container } = render(<ToolIcon type="terminal" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.querySelector("polyline")).toBeTruthy();
  });

  it("renders an SVG for file type", () => {
    const { container } = render(<ToolIcon type="file" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.querySelector("path")).toBeTruthy();
  });

  it("renders an SVG for search type", () => {
    const { container } = render(<ToolIcon type="search" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.querySelector("circle")).toBeTruthy();
  });

  it("renders an SVG for globe type", () => {
    const { container } = render(<ToolIcon type="globe" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.querySelector("circle")).toBeTruthy();
  });

  it("renders an SVG for message type", () => {
    const { container } = render(<ToolIcon type="message" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders an SVG for list type", () => {
    const { container } = render(<ToolIcon type="list" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders a default SVG for unknown type", () => {
    const { container } = render(<ToolIcon type="tool" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.querySelector("path")).toBeTruthy();
  });
});

// ─── ToolBlock component ─────────────────────────────────────────────────────

describe("ToolBlock", () => {
  it("renders with correct label and preview", () => {
    render(
      <ToolBlock
        name="Bash"
        input={{ command: "echo hello" }}
        toolUseId="tool-1"
      />
    );
    expect(screen.getByText("Terminal")).toBeTruthy();
    // Preview text appears in the header button area — may also appear in expanded view
    const allMatches = screen.getAllByText("echo hello");
    expect(allMatches.length).toBeGreaterThan(0);
    // The header preview span has the truncate class
    const previewSpan = allMatches.find((el) => el.className.includes("truncate"));
    expect(previewSpan).toBeTruthy();
    expect(previewSpan!.className).toContain("truncate");
  });

  it("renders with label only when no preview is available", () => {
    render(
      <ToolBlock
        name="WebFetch"
        input={{ url: "https://example.com" }}
        toolUseId="tool-2"
      />
    );
    expect(screen.getByText("WebFetch")).toBeTruthy();
  });

  it("is expanded by default (shows details)", () => {
    const { container } = render(
      <ToolBlock
        name="Bash"
        input={{ command: "ls -la" }}
        toolUseId="tool-3"
      />
    );
    // The expanded detail area is present by default (border-t class marks the expanded section)
    expect(container.querySelector(".border-t")).toBeTruthy();
  });

  it("collapses on click to hide input details", () => {
    const { container } = render(
      <ToolBlock
        name="Bash"
        input={{ command: "ls -la" }}
        toolUseId="tool-4"
      />
    );

    // Click the toggle button to collapse — it's the first button (the header toggle)
    const toggleButton = container.querySelector("button")!;
    fireEvent.click(toggleButton);

    // After collapsing, the detail area should not be visible
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("expands on second click after collapsing", () => {
    const { container } = render(
      <ToolBlock
        name="Bash"
        input={{ command: "ls -la" }}
        toolUseId="tool-5"
      />
    );

    const toggleButton = container.querySelector("button")!;

    // Collapse
    fireEvent.click(toggleButton);
    expect(container.querySelector(".border-t")).toBeNull();

    // Expand again
    fireEvent.click(toggleButton);
    expect(container.querySelector(".border-t")).toBeTruthy();
  });

  it("renders Bash command with $ prefix in expanded view", () => {
    render(
      <ToolBlock
        name="Bash"
        input={{ command: "npm install" }}
        toolUseId="tool-6"
      />
    );

    // ToolBlock is expanded by default — the command appears in both preview header and code block.
    const allMatches = screen.getAllByText("npm install");
    const preElement = allMatches.find((el) => el.closest("pre"))?.closest("pre");
    expect(preElement).toBeTruthy();
    // Check the $ prefix is rendered as a span inside the pre
    const dollarSpan = preElement?.querySelector("span");
    expect(dollarSpan?.textContent).toBe("$ ");
  });

  it("renders Edit diff view when expanded", () => {
    const { container } = render(
      <ToolBlock
        name="Edit"
        input={{
          file_path: "/home/user/src/app.txt",
          old_string: "old content",
          new_string: "new content",
        }}
        toolUseId="tool-7"
      />
    );

    // ToolBlock is expanded by default — check file path and diff section headers
    expect(container.textContent).toContain("/home/user/src/app.txt");
    // DiffView renders Before/After column headers
    expect(container.textContent).toContain("Before");
    expect(container.textContent).toContain("After");
    // Content without syntax highlighting (plain .txt file) renders as text
    expect(container.textContent).toContain("old content");
    expect(container.textContent).toContain("new content");
  });

  it("renders Read file path when expanded", () => {
    const { container } = render(
      <ToolBlock
        name="Read"
        input={{ file_path: "/home/user/test.txt" }}
        toolUseId="tool-8"
      />
    );

    // The full file path appears in the expanded section (may be rendered via linkifyText)
    expect(container.textContent).toContain("/home/user/test.txt");
  });

  it("renders JSON for unknown tools when expanded", () => {
    const { container } = render(
      <ToolBlock
        name="CustomTool"
        input={{ foo: "bar", count: 42 }}
        toolUseId="tool-9"
      />
    );

    const preElement = container.querySelector("pre");
    expect(preElement).toBeTruthy();
    expect(preElement?.textContent).toContain('"foo": "bar"');
    expect(preElement?.textContent).toContain('"count": 42');
  });
});
