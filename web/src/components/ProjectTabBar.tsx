import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // Guard: only include if the session doesn't already have a CWD pointing to
  // a different project — otherwise switching tabs briefly shows "running" on
  // the wrong tab until auto-resume completes.
  if (
    currentSessionId &&
    !ids.includes(currentSessionId) &&
    (activeProjectCwd || "").replace(/\\/g, "/") === p
  ) {
    const curState = bridgeSessions.get(currentSessionId);
    const curCwd = (curState?.cwd || "").replace(/\\/g, "/");
    // Only include if session has no CWD yet (pending init) or CWD matches this project
    if (!curCwd || curCwd === p || curCwd.startsWith(p + "/")) {
      ids.push(currentSessionId);
    }
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
  const hiddenProjects = useStore((s) => s.hiddenProjects);
  const toggleHiddenProject = useStore((s) => s.toggleHiddenProject);
  const [manageOpen, setManageOpen] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout>;

    function fetchProjects(attempt = 0) {
      api.listProjects().then((res) => {
        if (!active) return;
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
      }).catch(() => {
        // Retry with backoff: 1s, 2s, 4s (max 3 retries)
        if (active && attempt < 3) {
          retryTimer = setTimeout(() => fetchProjects(attempt + 1), 1000 * Math.pow(2, attempt));
        }
      });
    }
    fetchProjects();

    return () => {
      active = false;
      clearTimeout(retryTimer);
    };
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

  const visibleProjects = projects.filter((p) => !hiddenProjects.has(p.path));

  // Popup position — anchored below the manage button
  const btnRect = manageButtonRef.current?.getBoundingClientRect();
  const popupStyle = btnRect
    ? { position: "fixed" as const, top: btnRect.bottom + 4, right: window.innerWidth - btnRect.right }
    : { display: "none" as const };

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
        {visibleProjects.map((project) => (
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

      {/* Manage projects button */}
      <button
        ref={manageButtonRef}
        onClick={() => setManageOpen((o) => !o)}
        className={`shrink-0 flex items-center justify-center w-5 h-5 rounded transition-colors cursor-pointer ml-0.5 ${manageOpen ? "bg-cc-hover text-cc-fg" : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"}`}
        title="Manage projects"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Manage projects popup */}
      {manageOpen && createPortal(
        <>
          {/* Click-outside backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setManageOpen(false)} />
          <div
            className="z-[9999] bg-cc-card border border-cc-border rounded-lg shadow-xl py-2 min-w-[220px] max-h-[400px] overflow-y-auto"
            style={popupStyle}
          >
            <div className="px-3 pb-1.5 mb-1 border-b border-cc-border">
              <span className="text-[11px] font-semibold text-cc-muted uppercase tracking-wider">Projects</span>
            </div>
            {projects.map((project) => {
              const hidden = hiddenProjects.has(project.path);
              return (
                <label
                  key={project.path}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-cc-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => {
                      toggleHiddenProject(project.path);
                      // If we just hid the active project, switch to first visible
                      if (!hidden && activeProjectCwd === project.path) {
                        const next = projects.find((p) => p.path !== project.path && !hiddenProjects.has(p.path));
                        if (next) selectProject(next.path);
                      }
                    }}
                    className="accent-cc-primary w-3.5 h-3.5 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-cc-fg truncate">{project.name}</span>
                    <span className="text-[10px] text-cc-muted truncate">{project.path}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
