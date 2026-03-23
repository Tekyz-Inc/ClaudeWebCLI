import { useRef, useState } from "react";
import { api, type CompanionEnv } from "../api.js";

interface EnvSelectorProps {
  envs: CompanionEnv[];
  selectedEnv: string;
  onSelect: (slug: string) => void;
  onManage: () => void;
  onOpen: () => void;
}

export function EnvSelector({ envs, selectedEnv, onSelect, onManage, onOpen }: EnvSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function openDropdown() {
    if (!showDropdown) {
      onOpen();
      api.listEnvs().catch(() => {});
    }
    setShowDropdown(!showDropdown);
  }

  function selectEnv(slug: string) {
    onSelect(slug);
    localStorage.setItem("cc-selected-env", slug);
    setShowDropdown(false);
  }

  const displayName = selectedEnv
    ? envs.find((e) => e.slug === selectedEnv)?.name || "Env"
    : "No env";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={openDropdown}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-cc-muted hover:text-cc-fg rounded-md hover:bg-cc-hover transition-colors cursor-pointer"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
          <path d="M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z" />
        </svg>
        <span className="max-w-[120px] truncate">{displayName}</span>
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute left-0 bottom-full mb-1 w-56 bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-10 py-1 overflow-hidden">
          <button
            onClick={() => selectEnv("")}
            className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer ${
              !selectedEnv ? "text-cc-primary font-medium" : "text-cc-fg"
            }`}
          >
            No environment
          </button>
          {envs.map((env) => (
            <button
              key={env.slug}
              onClick={() => selectEnv(env.slug)}
              className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-1 ${
                env.slug === selectedEnv ? "text-cc-primary font-medium" : "text-cc-fg"
              }`}
            >
              <span className="truncate">{env.name}</span>
              <span className="text-cc-muted ml-auto shrink-0">
                {Object.keys(env.variables).length} var{Object.keys(env.variables).length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
          <div className="border-t border-cc-border mt-1 pt-1">
            <button
              onClick={() => { onManage(); setShowDropdown(false); }}
              className="w-full px-3 py-2 text-xs text-left text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
            >
              Manage environments...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
