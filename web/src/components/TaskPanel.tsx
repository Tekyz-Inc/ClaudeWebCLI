import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store.js";
import type { TaskItem, AgentSpawn, TestRun } from "../types.js";

const EMPTY_TASKS: TaskItem[] = [];
const EMPTY_SET = new Set<string>();
const EMPTY_CMDS: string[] = [];
const EMPTY_AGENTS: AgentSpawn[] = [];
const EMPTY_TESTS: TestRun[] = [];
const EMPTY_MODELS = new Map<string, { inputTokens: number; outputTokens: number; costUSD: number }>();
const COMPACT_THRESHOLD = 95;

function basename(p: string): string {
  return p.split(/[/\\]/).pop() || p;
}

/** Shorten model IDs like "claude-sonnet-4-6-20250514" → "Sonnet 4.6" */
function shortModelName(id: string): string {
  const m = id.match(/claude-(\w+)-(\d+)-(\d+)/);
  if (!m) return id;
  const family = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return `${family} ${m[2]}.${m[3]}`;
}

const TOOL_RE = /\b(vitest|playwright|jest|npm\s+(?:run\s+)?test|bun\s+(?:run\s+)?test|npx\s+playwright)\b/i;
const FILE_RE = /([\w/-]+\.(?:test|spec)\.[jt]sx?)/;

/** Primary label for the row — short enough to fit in the panel */
function testLabel(cmd: string, idx: number): string {
  const fileMatch = cmd.match(FILE_RE);
  if (fileMatch) {
    // Show last two path segments so "components/Foo.test.tsx" is readable
    const parts = fileMatch[1].split("/");
    const short = parts.slice(-2).join("/");
    return `#${idx + 1} · ${short}`;
  }
  const toolMatch = cmd.match(TOOL_RE);
  const base = toolMatch ? toolMatch[0].trim() : "test";
  // If there are extra args after the base command, show them
  const afterBase = cmd.slice(cmd.search(TOOL_RE) + base.length).trim().replace(/^--\s*/, "").trim();
  if (afterBase) {
    const trimmed = afterBase.length > 30 ? afterBase.slice(0, 30) + "…" : afterBase;
    return `#${idx + 1} · ${base} ${trimmed}`;
  }
  return `#${idx + 1} · ${base}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TaskPanel({ sessionId }: { sessionId: string }) {
  const tasks = useStore((s) => s.sessionTasks.get(sessionId) || EMPTY_TASKS);
  const session = useStore((s) => s.sessions.get(sessionId));
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const setTaskPanelOpen = useStore((s) => s.setTaskPanelOpen);
  const filesRead = useStore((s) => s.filesRead.get(sessionId) || EMPTY_SET);
  const changedFiles = useStore((s) => s.changedFiles.get(sessionId) || EMPTY_SET);
  const commands = useStore((s) => s.commandsExecuted.get(sessionId) || EMPTY_CMDS);
  const agents = useStore((s) => s.agentsSpawned.get(sessionId) || EMPTY_AGENTS);
  const tests = useStore((s) => s.testsExecuted.get(sessionId) || EMPTY_TESTS);
  const models = useStore((s) => s.modelsInvoked.get(sessionId) || EMPTY_MODELS);

  const [allExpanded, setAllExpanded] = useState(false);
  const [expandTick, setExpandTick] = useState(0);

  const toggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    setExpandTick((t) => t + 1);
  };

  if (!taskPanelOpen) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const contextPct = session?.context_used_percent ?? 0;
  const hasData = contextPct > 0;
  const contextRemaining = hasData ? 100 - contextPct : 100;
  const isCompacting = session?.is_compacting ?? false;
  const filesReadArr = Array.from(filesRead);
  const changedFilesArr = Array.from(changedFiles);

  const sp = { expandTick, expandTo: allExpanded };

  return (
    <aside className="w-[280px] h-full flex flex-col bg-cc-card border-l border-cc-border">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-cc-border">
        <span className="text-sm font-semibold text-cc-fg tracking-tight">Session</span>
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-cc-hover rounded-lg p-0.5">
            <button
              onClick={toggleAll}
              className={`px-2 py-0.5 rounded-md text-[11px] font-barlow-condensed font-medium tracking-wide transition-colors cursor-pointer ${
                allExpanded ? "bg-cc-card text-cc-fg shadow-sm" : "text-cc-muted hover:text-cc-fg"
              }`}
            >
              {allExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          <button
            onClick={() => setTaskPanelOpen(false)}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Context */}
        {session && (
          <div className="px-4 py-3 border-b border-cc-border">
            <ContextMeter contextPct={contextPct} contextRemaining={contextRemaining} hasData={hasData} isCompacting={isCompacting} />
          </div>
        )}

        {/* Models Invoked */}
        <Section label="Models" count={models.size} {...sp}>
          {Array.from(models.entries()).map(([name, usage]) => (
            <div key={name} className="px-4 py-0.5 flex items-center gap-1.5" title={`${name}\nIn: ${usage.inputTokens.toLocaleString()} · Out: ${usage.outputTokens.toLocaleString()}`}>
              <span className="text-[8px] leading-none text-cc-primary shrink-0">●</span>
              <span className="text-[10px] text-cc-muted truncate flex-1">{shortModelName(name)}</span>
            </div>
          ))}
        </Section>

        {/* Files Read */}
        <Section label="Files Read" count={filesReadArr.length} {...sp}>
          {filesReadArr.map((f, i) => <FileRow key={i} path={f} />)}
        </Section>

        {/* Files Updated */}
        <Section label="Files Updated" count={changedFilesArr.length} {...sp}>
          {changedFilesArr.map((f, i) => <FileRow key={i} path={f} updated />)}
        </Section>

        {/* Commands — slash commands and GSD-T skills only */}
        <Section label="Commands" count={commands.length} {...sp}>
          {commands.map((cmd, i) => (
            <div key={i} className="px-4 py-0.5 flex items-center gap-1.5" title={cmd}>
              <span className="text-[8px] leading-none text-cc-primary shrink-0">◆</span>
              <span className="text-[10px] text-cc-muted truncate">{cmd}</span>
            </div>
          ))}
        </Section>

        {/* Agents */}
        <Section label="Agents" count={agents.length} {...sp}>
          {agents.map((a, i) => (
            <div key={i} className="px-4 py-0.5 flex items-start gap-1.5" title={a.description}>
              <span className="text-[8px] leading-none mt-1 text-cc-primary shrink-0">◆</span>
              <div className="min-w-0">
                <span className="text-[10px] text-cc-muted truncate block">{a.description}</span>
                {a.subagentType && (
                  <span className="text-[9px] text-cc-muted/60 italic">{a.subagentType}</span>
                )}
              </div>
            </div>
          ))}
        </Section>

        {/* QA */}
        <Section label="QA" count={tests.length} {...sp}>
          {tests.map((t, i) => <TestRow key={i} t={t} i={i} />)}
        </Section>

        {/* Tasks */}
        <Section label="Tasks" count={tasks.length} badge={tasks.length > 0 ? `${completedCount}/${tasks.length}` : undefined} {...sp}>
          <div className="px-2 py-1 space-y-px">
            {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  label, count, badge, children, expandTick, expandTo,
}: {
  label: string; count: number; badge?: string; children: ReactNode;
  expandTick: number; expandTo: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (expandTick > 0) setOpen(expandTo);
  }, [expandTick, expandTo]);

  return (
    <div className="border-b border-cc-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-cc-hover transition-colors cursor-pointer"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-2.5 h-2.5 text-cc-muted/60 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span className="text-[11px] font-semibold text-cc-muted uppercase tracking-wider flex-1">{label}</span>
        {count > 0 && (
          <span className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full bg-cc-hover text-cc-muted">
            {badge ?? count}
          </span>
        )}
      </button>
      {open && <div className="pb-1.5">{children}</div>}
    </div>
  );
}

function FileRow({ path, updated }: { path: string; updated?: boolean }) {
  return (
    <div className="px-4 py-0.5 flex items-center gap-1.5" title={path}>
      <span className={`text-[8px] leading-none ${updated ? "text-cc-warning" : "text-cc-primary"}`}>●</span>
      <span className="text-[10px] text-cc-muted truncate">{basename(path)}</span>
    </div>
  );
}

function ContextMeter({ contextPct, contextRemaining, hasData, isCompacting }: {
  contextPct: number;
  contextRemaining: number;
  hasData: boolean;
  isCompacting: boolean;
}) {
  const barColor = !hasData ? "bg-cc-hover"
    : contextRemaining < 5 ? "bg-red-500"
    : contextRemaining < 20 ? "bg-orange-500"
    : contextRemaining < 40 ? "bg-yellow-500"
    : "bg-green-500";

  const remainingColor = !hasData ? "text-cc-muted"
    : contextRemaining < 5 ? "text-red-500"
    : contextRemaining < 20 ? "text-orange-500"
    : contextRemaining < 40 ? "text-yellow-500"
    : "text-green-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-cc-muted uppercase tracking-wider">Context</span>
        {isCompacting && <span className="text-[10px] text-cc-warning font-medium animate-pulse">Compacting…</span>}
      </div>
      <div className="relative w-full h-1.5 rounded-full bg-cc-hover overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${hasData ? Math.min(contextPct, 100) : 0}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-cc-muted/40"
          style={{ left: `${COMPACT_THRESHOLD}%` }}
          title={`Auto-compact at ~${COMPACT_THRESHOLD}%`}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-cc-muted">{hasData ? `${contextPct}% used` : "--"}</span>
        <span className={remainingColor}>{hasData ? `${contextRemaining}% left until compact` : "--"}</span>
      </div>
    </div>
  );
}

function TestRow({ t, i }: { t: TestRun; i: number }) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const label = testLabel(t.cmd, i);
  const isAgent = t.source === "agent";

  return (
    <>
      <div
        className="px-4 py-0.5 flex items-center gap-1.5 cursor-default"
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltipPos({ x: rect.right + 8, y: rect.top });
        }}
        onMouseLeave={() => setTooltipPos(null)}
      >
        <span className={`text-[8px] leading-none shrink-0 ${isAgent ? "text-cc-warning" : "text-green-500"}`}>●</span>
        <span className="text-[10px] text-cc-muted flex-1 truncate">{label}</span>
        <span className={`text-[9px] font-medium shrink-0 ${isAgent ? "text-cc-warning/80" : "text-green-500/80"}`}>
          {isAgent ? "QA Agent" : "Direct"}
        </span>
      </div>
      {tooltipPos && createPortal(
        <div
          className="fixed z-[9999] bg-cc-card border border-cc-border rounded-lg shadow-lg px-3 py-2 text-[11px] text-cc-fg max-w-[320px] pointer-events-none space-y-1.5"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="font-medium text-cc-fg">Run #{i + 1}</div>
          <div className="font-mono-code text-[10px] text-cc-muted bg-cc-code-bg rounded px-2 py-1 break-all leading-relaxed">
            {t.cmd}
          </div>
          <div className="flex items-center justify-between text-[10px] text-cc-muted">
            <span className={isAgent ? "text-cc-warning/80" : "text-green-500/80"}>
              {isAgent ? "QA Agent (subagent)" : "Direct"}
            </span>
            {t.timestamp > 0 && <span>{formatTime(t.timestamp)}</span>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function TaskRow({ task }: { task: TaskItem }) {
  const isCompleted = task.status === "completed";
  const isInProgress = task.status === "in_progress";

  return (
    <div className={`px-2 py-1 rounded ${isCompleted ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 flex items-center justify-center w-3 h-3 mt-px">
          {isInProgress ? (
            <svg className="w-3 h-3 text-cc-primary animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
            </svg>
          ) : isCompleted ? (
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-success">
              <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.708L7 8.586 5.354 6.94a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-cc-muted">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </span>
        <span className={`text-[11px] leading-snug flex-1 ${isCompleted ? "text-cc-muted line-through" : "text-cc-fg"}`}>
          {task.subject}
        </span>
      </div>
      {isInProgress && task.activeForm && (
        <p className="mt-0.5 ml-4.5 text-[10px] text-cc-muted italic truncate">{task.activeForm}</p>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <p className="mt-0.5 ml-4.5 text-[10px] text-cc-muted truncate">
          blocked by {task.blockedBy.map((b) => `#${b}`).join(", ")}
        </p>
      )}
    </div>
  );
}
