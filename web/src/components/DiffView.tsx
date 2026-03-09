import { useMemo } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/atom-one-dark.min.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type SideLine = {
  num: number;
  content: string;
  type: "added" | "removed" | "context";
} | null;

type DiffRow = {
  left: SideLine;
  right: SideLine;
  isHeader?: boolean;
  headerText?: string;
};

// ─── Language detection ───────────────────────────────────────────────────────

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript",
  py: "python",
  html: "xml", htm: "xml", xml: "xml", svg: "xml",
  css: "css", scss: "css", less: "css",
  json: "json",
  md: "markdown", mdx: "markdown",
  sh: "bash", bash: "bash", zsh: "bash",
  rs: "rust", go: "go",
  java: "java", kt: "kotlin", swift: "swift",
  rb: "ruby", php: "php",
  c: "c", h: "c", cpp: "cpp", cc: "cpp",
  cs: "csharp", sql: "sql",
  yaml: "yaml", yml: "yaml",
  toml: "ini", ini: "ini",
  dart: "dart",
};

function detectLang(diff: string): string | null {
  const m = diff.match(/^(?:\+\+\+|---) (?:[ab]\/)?(.+)/m);
  if (!m) return null;
  const ext = m[1].trim().split(".").pop()?.toLowerCase() || "";
  return EXT_LANG[ext] || null;
}

// ─── Diff parser ──────────────────────────────────────────────────────────────

export function parseDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = diff.split("\n");
  let oldNum = 0;
  let newNum = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (
      line.startsWith("diff ") || line.startsWith("index ") ||
      line.startsWith("--- ") || line.startsWith("+++ ")
    ) { i++; continue; }

    if (line.startsWith("@@")) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldNum = parseInt(m[1], 10); newNum = parseInt(m[2], 10); }
      rows.push({ left: null, right: null, isHeader: true, headerText: line });
      i++; continue;
    }

    if (line.startsWith("-") || line.startsWith("+")) {
      const removed: string[] = [];
      const added: string[] = [];
      while (i < lines.length && (lines[i].startsWith("-") || lines[i].startsWith("+"))) {
        if (lines[i].startsWith("-")) removed.push(lines[i].slice(1));
        else added.push(lines[i].slice(1));
        i++;
      }
      const len = Math.max(removed.length, added.length);
      for (let j = 0; j < len; j++) {
        rows.push({
          left: j < removed.length ? { num: oldNum++, content: removed[j], type: "removed" } : null,
          right: j < added.length ? { num: newNum++, content: added[j], type: "added" } : null,
        });
      }
      continue;
    }

    if (line.startsWith(" ")) {
      const content = line.slice(1);
      rows.push({
        left: { num: oldNum++, content, type: "context" },
        right: { num: newNum++, content, type: "context" },
      });
    }
    i++;
  }
  return rows;
}

// ─── Syntax highlighting helpers ──────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Split highlight.js HTML output into per-line strings, keeping spans balanced. */
function splitHighlightedHtml(html: string): string[] {
  const result: string[] = [];
  const openStack: string[] = [];
  for (const line of html.split("\n")) {
    const prefixed = openStack.join("") + line;
    for (const m of line.matchAll(/<span[^>]*>/g)) openStack.push(m[0]);
    const closeCount = (line.match(/<\/span>/g) || []).length;
    for (let i = 0; i < closeCount; i++) openStack.pop();
    result.push(prefixed + "</span>".repeat(openStack.length));
  }
  return result;
}

function buildHighlights(contents: (string | null)[], lang: string): string[] {
  const code = contents.map((c) => c ?? "").join("\n");
  try {
    const html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    return splitHighlightedHtml(html);
  } catch {
    return contents.map((c) => escHtml(c ?? ""));
  }
}

// ─── Cell styling ─────────────────────────────────────────────────────────────

function cellBg(line: SideLine, side: "left" | "right"): string {
  if (!line) return "bg-cc-code-bg/20";
  if (side === "left" && line.type === "removed") return "bg-red-950/40";
  if (side === "right" && line.type === "added") return "bg-green-950/40";
  return "";
}

function markerColor(line: SideLine, side: "left" | "right"): string {
  if (side === "left" && line?.type === "removed") return "text-red-400/70";
  if (side === "right" && line?.type === "added") return "text-green-400/70";
  return "text-cc-muted/20";
}

function marker(line: SideLine, side: "left" | "right"): string {
  if (side === "left" && line?.type === "removed") return "−";
  if (side === "right" && line?.type === "added") return "+";
  return " ";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DiffView({ diff }: { diff: string }) {
  const rows = useMemo(() => parseDiff(diff), [diff]);
  const lang = useMemo(() => detectLang(diff), [diff]);

  // Map each non-header row to an index into the content arrays
  const { leftHl, rightHl, rowContentIdx } = useMemo(() => {
    const leftContents: (string | null)[] = [];
    const rightContents: (string | null)[] = [];
    const rowContentIdx: number[] = [];
    let ci = 0;
    for (const row of rows) {
      if (row.isHeader) { rowContentIdx.push(-1); continue; }
      rowContentIdx.push(ci++);
      leftContents.push(row.left?.content ?? null);
      rightContents.push(row.right?.content ?? null);
    }
    if (!lang) return { leftHl: null, rightHl: null, rowContentIdx };
    return {
      leftHl: buildHighlights(leftContents, lang),
      rightHl: buildHighlights(rightContents, lang),
      rowContentIdx,
    };
  }, [rows, lang]);

  if (!diff) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-cc-muted text-sm">No changes</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto font-mono-code text-[11px]">
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-8" /><col className="w-1/2" />
          <col className="w-8" /><col className="w-1/2" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-cc-card">
          <tr>
            <th colSpan={2} className="px-3 py-1 text-left text-[10px] font-medium text-cc-muted border-b border-r border-cc-border">Before</th>
            <th colSpan={2} className="px-3 py-1 text-left text-[10px] font-medium text-cc-muted border-b border-cc-border">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.isHeader) {
              return (
                <tr key={i}>
                  <td colSpan={4} className="px-3 py-0.5 text-[11px] text-cc-primary bg-cc-primary/5 border-y border-cc-border font-mono-code">
                    {row.headerText}
                  </td>
                </tr>
              );
            }
            const ci = rowContentIdx[i];
            const lHtml = ci >= 0 && leftHl ? leftHl[ci] : null;
            const rHtml = ci >= 0 && rightHl ? rightHl[ci] : null;
            return (
              <tr key={i}>
                <td className={`px-1 py-px text-right text-cc-muted/40 select-none border-r border-cc-border/40 text-[9px] align-top shrink-0 ${cellBg(row.left, "left")}`}>
                  {row.left?.num}
                </td>
                <td className={`py-px pl-1 pr-2 border-r border-cc-border text-[10px] leading-[1.35] ${cellBg(row.left, "left")}`}>
                  {row.left && (
                    <span className="flex">
                      <span className={`select-none mr-1 shrink-0 ${markerColor(row.left, "left")}`}>{marker(row.left, "left")}</span>
                      {lHtml
                        ? <span dangerouslySetInnerHTML={{ __html: lHtml }} className="whitespace-pre-wrap break-all" style={{ color: '#abb2bf' }} />
                        : <span className="whitespace-pre-wrap break-all" style={{ color: '#abb2bf' }}>{row.left.content}</span>
                      }
                    </span>
                  )}
                </td>
                <td className={`px-1 py-px text-right text-cc-muted/40 select-none border-r border-cc-border/40 text-[9px] align-top shrink-0 ${cellBg(row.right, "right")}`}>
                  {row.right?.num}
                </td>
                <td className={`py-px pl-1 pr-2 text-[10px] leading-[1.35] ${cellBg(row.right, "right")}`}>
                  {row.right && (
                    <span className="flex">
                      <span className={`select-none mr-1 shrink-0 ${markerColor(row.right, "right")}`}>{marker(row.right, "right")}</span>
                      {rHtml
                        ? <span dangerouslySetInnerHTML={{ __html: rHtml }} className="whitespace-pre-wrap break-all" style={{ color: '#abb2bf' }} />
                        : <span className="whitespace-pre-wrap break-all" style={{ color: '#abb2bf' }}>{row.right.content}</span>
                      }
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
