const TOOL_ICONS: Record<string, string> = {
  Bash: "terminal",
  Read: "file",
  Write: "file-plus",
  Edit: "file-edit",
  Glob: "search",
  Grep: "search",
  WebFetch: "globe",
  WebSearch: "globe",
  NotebookEdit: "file-edit",
  TaskCreate: "list",
  TaskUpdate: "list",
  TodoWrite: "list",
  SendMessage: "message",
};

export function getToolIcon(name: string): string {
  return TOOL_ICONS[name] || "tool";
}

export function getToolLabel(name: string): string {
  if (name === "Bash") return "Terminal";
  if (name === "Read") return "Read File";
  if (name === "Write") return "Write File";
  if (name === "Edit") return "Edit File";
  if (name === "Glob") return "Find Files";
  if (name === "Grep") return "Search Content";
  if (name === "TodoWrite") return "Todo List";
  return name;
}

export function getPreview(name: string, input: Record<string, unknown>): string {
  if (name === "Bash" && typeof input.command === "string") {
    return input.command.length > 60 ? input.command.slice(0, 60) + "..." : input.command;
  }
  if ((name === "Read" || name === "Write" || name === "Edit") && input.file_path) {
    const path = String(input.file_path);
    return path.split("/").slice(-2).join("/");
  }
  if (name === "Glob" && input.pattern) return String(input.pattern);
  if (name === "Grep" && input.pattern) return String(input.pattern);
  if (name === "WebSearch" && input.query) return String(input.query);
  if (name === "TodoWrite" && Array.isArray(input.todos)) {
    const done = (input.todos as Array<{ status: string }>).filter((t) => t.status === "completed").length;
    return `${done}/${input.todos.length} done`;
  }
  return "";
}
