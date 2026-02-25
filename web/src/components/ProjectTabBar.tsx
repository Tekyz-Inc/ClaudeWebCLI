import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";

interface Project {
  name: string;
  path: string;
}

type TabStatus = "running" | "waiting" | "idle";

function useProjectStatus(projectPath: string): TabStatus {
  const sdkSessions = useStore((s) => s.sdkSessions);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const pendingPermissions = useStore((s) => s.pendingPermissions);

  const ids = sdkSessions
    .filter((s) => {
      const cwd = (s.cwd || "").replace(/\\/g, "/");
      const p = projectPath.replace(/\\/g, "/");
      return cwd === p || cwd.startsWith(p + "/");
    })
    .map((s) => s.sessionId);

  if (ids.some((id) => (pendingPermissions.get(id)?.size ?? 0) > 0)) return "waiting";
  if (ids.some((id) => sessionStatus.get(id) === "running")) return "running";
  return "idle";
}

function StatusIndicator({ status, hasSessions }: { status: TabStatus; hasSessions: boolean }) {
  if (status === "running") {
    return (
      <span className="w-1.5 h-1.5 rounded-full bg-cc-primary animate-[pulse-dot_1s_ease-in-out_infinite] shrink-0" />
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
  const status = useProjectStatus(project.path);
  const hasSessions = sdkSessions.some((s) => {
    const cwd = (s.cwd || "").replace(/\\/g, "/");
    const p = project.path.replace(/\\/g, "/");
    return (cwd === p || cwd.startsWith(p + "/")) && !s.archived;
  });

  return (
    <button
      onClick={onClick}
      title={project.path}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
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

  useEffect(() => {
    api.listProjects().then((res) => {
      // Deduplicate by normalized path (handles same project listed multiple times)
      const seen = new Set<string>();
      const unique = res.projects.filter((p) => {
        const key = p.path.replace(/\\/g, "/").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setProjects(unique);
    }).catch(() => {});
  }, []);

  if (projects.length === 0) return null;

  return (
    <div className="shrink-0 bg-cc-sidebar border-b border-cc-border">
      <div
        className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        <button
          onClick={() => setActiveProjectCwd(null)}
          className={`flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            activeProjectCwd === null
              ? "bg-cc-card text-cc-fg shadow-sm"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
        >
          All
        </button>
        {projects.map((project) => (
          <ProjectTabItem
            key={project.path}
            project={project}
            isActive={activeProjectCwd === project.path}
            onClick={() => setActiveProjectCwd(project.path)}
          />
        ))}
      </div>
    </div>
  );
}
