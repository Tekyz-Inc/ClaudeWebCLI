import { useState, useEffect } from "react";
import { useStore } from "../store.js";
import { DiffView } from "./DiffView.js";
import { getToolIcon, getToolLabel, getPreview } from "./tool-utils.js";
import { CopyButton } from "./CopyButton.js";
import { linkifyText } from "../utils/linkify.js";

export function ToolBlock({
  name,
  input,
  toolUseId,
}: {
  name: string;
  input: Record<string, unknown>;
  toolUseId: string;
}) {
  const chatExpanded = useStore((s) => s.chatExpanded);
  const chatExpandTick = useStore((s) => s.chatExpandTick);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (chatExpandTick > 0) setOpen(chatExpanded);
  }, [chatExpandTick, chatExpanded]);

  const iconType = getToolIcon(name);
  const label = getToolLabel(name);

  // Extract the most useful preview
  const preview = getPreview(name, input);

  return (
    <div className="border border-cc-border rounded-[10px] overflow-hidden bg-cc-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-cc-hover transition-colors cursor-pointer"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <ToolIcon type={iconType} />
        <span className="text-xs font-medium text-cc-fg">{label}</span>
        {preview && (
          <span className="text-xs text-cc-muted truncate flex-1 font-mono-code">
            {preview}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-cc-border">
          <div className="mt-2">
            {name === "Bash" && typeof input.command === "string" ? (
              <div className="group/bash relative">
                <pre className="px-3 py-2 rounded-lg bg-cc-code-bg text-cc-code-fg text-[12px] font-mono-code leading-relaxed overflow-x-auto">
                  <span className="text-cc-muted select-none">$ </span>
                  {input.command}
                </pre>
                <CopyButton
                  text={input.command}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded hover:bg-cc-hover opacity-0 group-hover/bash:opacity-100 transition-opacity"
                />
              </div>
            ) : name === "Edit" ? (
              <EditToolDetail input={input} />
            ) : name === "Write" ? (
              <WriteToolDetail input={input} />
            ) : name === "Read" ? (
              <div className="text-xs text-cc-muted font-mono-code">
                {linkifyText(String(input.file_path || input.path || ""))}
              </div>
            ) : (
              <pre className="text-[11px] text-cc-muted font-mono-code whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {JSON.stringify(input, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type DiffOp = ["keep" | "remove" | "add", string];

function lcs(a: string[], b: string[]): DiffOp[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops: DiffOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { ops.unshift(["keep", a[i-1]]); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.unshift(["add", b[j-1]]); j--; }
    else { ops.unshift(["remove", a[i-1]]); i--; }
  }
  return ops;
}

function buildUnifiedDiff(oldStr: string, newStr: string, filePath: string): string {
  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];
  const ops = lcs(oldLines, newLines);
  const CONTEXT = 3;

  // Find indices of changed ops
  const changed = ops.reduce<number[]>((acc, op, i) => { if (op[0] !== "keep") acc.push(i); return acc; }, []);
  if (changed.length === 0) return "";

  // Group changes into hunks
  const hunks: Array<[number, number]> = [];
  let hs = Math.max(0, changed[0] - CONTEXT);
  let he = Math.min(ops.length - 1, changed[0] + CONTEXT);
  for (let k = 1; k < changed.length; k++) {
    const ci = changed[k];
    if (ci - CONTEXT <= he + 1) { he = Math.min(ops.length - 1, ci + CONTEXT); }
    else { hunks.push([hs, he]); hs = Math.max(0, ci - CONTEXT); he = Math.min(ops.length - 1, ci + CONTEXT); }
  }
  hunks.push([hs, he]);

  // Build line number counters by scanning ops in order
  const opOldLine: number[] = [];
  const opNewLine: number[] = [];
  let ol = 1, nl = 1;
  for (const [type] of ops) {
    opOldLine.push(ol); opNewLine.push(nl);
    if (type !== "add") ol++;
    if (type !== "remove") nl++;
  }

  const out = [`--- a/${filePath}`, `+++ b/${filePath}`];
  for (const [hs, he] of hunks) {
    const slice = ops.slice(hs, he + 1);
    const oldCount = slice.filter(([t]) => t !== "add").length;
    const newCount = slice.filter(([t]) => t !== "remove").length;
    out.push(`@@ -${opOldLine[hs]},${oldCount} +${opNewLine[hs]},${newCount} @@`);
    for (const [type, line] of slice) {
      out.push((type === "keep" ? " " : type === "remove" ? "-" : "+") + line);
    }
  }
  return out.join("\n");
}

function EditToolDetail({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const oldStr = String(input.old_string || "");
  const newStr = String(input.new_string || "");
  const diff = buildUnifiedDiff(oldStr, newStr, filePath);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-cc-muted font-mono-code truncate flex-1">
          {linkifyText(filePath)}
        </div>
        {diff && <CopyButton text={diff} className="w-5 h-5 rounded hover:bg-cc-hover shrink-0" />}
      </div>
      <div className="rounded border border-cc-border overflow-auto bg-cc-code-bg max-h-72">
        <DiffView diff={diff} />
      </div>
    </div>
  );
}

function WriteToolDetail({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const content = String(input.content || "");
  const preview = content.length > 500 ? content.slice(0, 500) + "..." : content;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-cc-muted font-mono-code truncate flex-1">
          {linkifyText(filePath)}
        </div>
        {content && <CopyButton text={content} className="w-5 h-5 rounded hover:bg-cc-hover shrink-0" />}
      </div>
      <div className="group/write relative">
        <pre className="px-3 py-2 rounded-lg bg-cc-code-bg text-cc-code-fg text-[11px] font-mono-code leading-relaxed overflow-x-auto max-h-40 overflow-y-auto">
          {preview}
        </pre>
      </div>
    </div>
  );
}

export function ToolIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5 text-cc-primary shrink-0";

  if (type === "terminal") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <polyline points="3 11 6 8 3 5" />
        <line x1="8" y1="11" x2="13" y2="11" />
      </svg>
    );
  }
  if (type === "file" || type === "file-plus" || type === "file-edit") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
        <polyline points="9 1 9 5 13 5" />
      </svg>
    );
  }
  if (type === "search") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <circle cx="7" cy="7" r="4" />
        <path d="M13 13l-3-3" />
      </svg>
    );
  }
  if (type === "globe") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2c2 2 3 4 3 6s-1 4-3 6c-2-2-3-4-3-6s1-4 3-6z" />
      </svg>
    );
  }
  if (type === "message") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M14 10a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1h10a1 1 0 011 1v7z" />
      </svg>
    );
  }
  if (type === "list") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M3 4h10M3 8h10M3 12h6" />
      </svg>
    );
  }
  // Default tool icon
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
      <path d="M10.5 2.5l3 3-8 8H2.5v-3l8-8z" />
    </svg>
  );
}
