import { useEffect, useRef, useState } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";

interface Project {
  name: string;
  path: string;
}

type TabStatus = "running" | "submitted" | "waiting" | "idle";

function useProjectStatus(projectPath: string): TabStatus {
  const sdkSessions = useStore((s) => s.sdkSessions);
  const bridgeSessions = useStore((s) => s.sessions);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const pendingPermissions = useStore((s) => s.pendingPermissions);
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);
  const currentSessionId = useStore((s) => s.currentSessionId);

  const p = projectPath.replace(/\\/g, "/");
  const ids: string[] = [];

  // Real-time bridge sessions (populated immediately when CLI connects)
  for (const [id, state] of bridgeSessions) {
    const cwd = (state.cwd || "").replace(/\\/g, "/");
    if (cwd === p || cwd.startsWith(p + "/")) ids.push(id);
  }

  // Polled SDK sessions (catches sessions from tabs not currently active)
  for (const s of sdkSessions) {
    if (!ids.includes(s.sessionId)) {
      const cwd = (s.cwd || "").replace(/\\/g, "/");
      if (cwd === p || cwd.startsWith(p + "/")) ids.push(s.sessionId);
    }
  }

  // Direct fallback: if this tab is active and currentSessionId isn't in ids yet
  // (fresh session before CLI sends session_init or before next poll), include it
  // so the running indicator fires immediately on submit.
  if (
    currentSessionId &&
    !ids.includes(currentSessionId) &&
    (activeProjectCwd || "").replace(/\\/g, "/") === p
  ) {
    ids.push(currentSessionId);
  }

  if (ids.some((id) => (pendingPermissions.get(id)?.size ?? 0) > 0)) return "waiting";
  if (ids.some((id) => sessionStatus.get(id) === "submitted")) return "submitted";
  if (ids.some((id) => sessionStatus.get(id) === "running")) return "running";
  return "idle";
}

function StatusIndicator({ status, hasSessions }: { status: TabStatus; hasSessions: boolean }) {
  if (status === "submitted") {
    return (
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
    );
  }
  if (status === "running") {
    return (
      <span className="w-2 h-2 rounded-full bg-green-500 animate-[pulse-dot_1.2s_ease-in-out_infinite] shrink-0" />
    );
  }
  if (status === "waiting") {
    return (
      <span className="text-[9px] font-bold text-cc-warning leading-none shrink-0 tracking-tighter">??</span>
    );
  }
  if (hasSessions) {
    return (
      <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-cc-success shrink-0">
        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function ProjectTabItem({ project, isActive, onClick }: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}) {
  const sdkSessions = useStore((s) => s.sdkSessions);
  const bridgeSessions = useStore((s) => s.sessions);
  const status = useProjectStatus(project.path);
  const p = project.path.replace(/\\/g, "/");
  const hasSessions =
    sdkSessions.some((s) => {
      const cwd = (s.cwd || "").replace(/\\/g, "/");
      return (cwd === p || cwd.startsWith(p + "/")) && !s.archived;
    }) ||
    Array.from(bridgeSessions.values()).some((s) => {
      const cwd = (s.cwd || "").replace(/\\/g, "/");
      return cwd === p || cwd.startsWith(p + "/");
    });

  return (
    <button
      onClick={onClick}
      title={project.path}
      data-active={isActive ? "true" : "false"}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-barlow-condensed font-medium tracking-wide whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
        isActive
          ? "bg-cc-card text-cc-fg shadow-sm"
          : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
      }`}
    >
      <span>{project.name}</span>
      <StatusIndicator status={status} hasSessions={hasSessions} />
    </button>
  );
}

export function ProjectTabBar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);
  const setActiveProjectCwd = useStore((s) => s.setActiveProjectCwd);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listProjects().then((res) => {
      const seen = new Set<string>();
      const unique = res.projects.filter((p) => {
        const key = p.path.replace(/\\/g, "/").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      unique.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setProjects(unique);
      const saved = localStorage.getItem("cc-active-project");
      if (saved && !activeProjectCwd) {
        const match = unique.find((p) => p.path === saved);
        if (match) setActiveProjectCwd(match.path);
        else if (unique.length > 0) setActiveProjectCwd(unique[0].path);
      } else if (!activeProjectCwd && unique.length > 0) {
        setActiveProjectCwd(unique[0].path);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep active tab scrolled into view whenever selection or project list changes
  useEffect(() => {
    if (!scrollRef.current || !activeProjectCwd) return;
    const btn = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    if (btn) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeProjectCwd, projects]);

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  }

  function selectProject(path: string) {
    setActiveProjectCwd(path);
    localStorage.setItem("cc-active-project", path);
  }

  if (projects.length === 0) return null;

  return (
    <div className="shrink-0 bg-cc-sidebar border-b border-cc-border flex items-center gap-0.5 px-1 py-0.5">
      {/* Left scroll arrow */}
      <button
        onClick={() => scroll("left")}
        className="shrink-0 flex items-center justify-center w-4 h-5 rounded text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
        title="Scroll left"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>

      {/* Scrollable tab strip */}
      <div ref={scrollRef} className="flex-1 flex items-center gap-px tabs-scroll">
        {projects.map((project) => (
          <ProjectTabItem
            key={project.path}
            project={project}
            isActive={activeProjectCwd === project.path}
            onClick={() => selectProject(project.path)}
          />
        ))}
      </div>

      {/* Right scroll arrow */}
      <button
        onClick={() => scroll("right")}
        className="shrink-0 flex items-center justify-center w-4 h-5 rounded text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
        title="Scroll right"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}
