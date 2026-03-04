import { type ReactNode } from "react";
import { useStore } from "../store.js";
import type { TaskItem } from "../types.js";

const EMPTY_TASKS: TaskItem[] = [];
const EMPTY_SET = new Set<string>();
const EMPTY_CMDS: string[] = [];
const COMPACT_THRESHOLD = 95;

function basename(p: string): string {
  return p.split(/[/\\]/).pop() || p;
}

function shortCmd(cmd: string): string {
  const first = cmd.split("\n")[0].trim();
  return first.length > 55 ? first.slice(0, 55) + "…" : first;
}

export function TaskPanel({ sessionId }: { sessionId: string }) {
  const tasks = useStore((s) => s.sessionTasks.get(sessionId) || EMPTY_TASKS);
  const session = useStore((s) => s.sessions.get(sessionId));
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const setTaskPanelOpen = useStore((s) => s.setTaskPanelOpen);
  const filesRead = useStore((s) => s.filesRead.get(sessionId) || EMPTY_SET);
  const changedFiles = useStore((s) => s.changedFiles.get(sessionId) || EMPTY_SET);
  const commands = useStore((s) => s.commandsExecuted.get(sessionId) || EMPTY_CMDS);

  if (!taskPanelOpen) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const contextPct = session?.context_used_percent ?? 0;
  const hasData = contextPct > 0;
  const contextRemaining = hasData ? 100 - contextPct : 100;
  const isCompacting = session?.is_compacting ?? false;
  const filesReadArr = Array.from(filesRead);
  const changedFilesArr = Array.from(changedFiles);

  return (
    <aside className="w-[280px] h-full flex flex-col bg-cc-card border-l border-cc-border">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-cc-border">
        <span className="text-sm font-semibold text-cc-fg tracking-tight">Session</span>
        <button
          onClick={() => setTaskPanelOpen(false)}
          className="flex items-center justify-center w-6 h-6 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Context */}
        {session && (
          <div className="px-4 py-3 border-b border-cc-border">
            <ContextMeter contextPct={contextPct} contextRemaining={contextRemaining} hasData={hasData} isCompacting={isCompacting} />
          </div>
        )}

        {/* Files Read */}
        <Section label="Files Read" count={filesReadArr.length}>
          {filesReadArr.length === 0 ? <Empty /> : filesReadArr.map((f, i) => <FileRow key={i} path={f} />)}
        </Section>

        {/* Files Updated */}
        <Section label="Files Updated" count={changedFilesArr.length}>
          {changedFilesArr.length === 0 ? <Empty /> : changedFilesArr.map((f, i) => <FileRow key={i} path={f} updated />)}
        </Section>

        {/* Commands */}
        <Section label="Commands" count={commands.length}>
          {commands.length === 0 ? (
            <Empty />
          ) : (
            commands.map((cmd, i) => (
              <div key={i} className="px-4 py-0.5" title={cmd}>
                <span className="text-[10px] font-mono text-cc-muted truncate block">{shortCmd(cmd)}</span>
              </div>
            ))
          )}
        </Section>

        {/* Tasks */}
        <div className="px-4 py-2 border-b border-cc-border flex items-center justify-between">
          <span className="text-[11px] font-semibold text-cc-muted uppercase tracking-wider">Tasks</span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-cc-muted tabular-nums">{completedCount}/{tasks.length}</span>
          )}
        </div>
        <div className="px-2 py-1">
          {tasks.length === 0 ? (
            <p className="text-[10px] text-cc-muted text-center py-4">No tasks yet</p>
          ) : (
            <div className="space-y-px">
              {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div className="border-b border-cc-border">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-cc-muted uppercase tracking-wider">{label}</span>
        {count > 0 && <span className="text-[10px] text-cc-muted tabular-nums">{count}</span>}
      </div>
      <div className="pb-1.5">{children}</div>
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

function Empty() {
  return <div className="px-4 pb-1 text-[10px] text-cc-muted/50">None</div>;
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
