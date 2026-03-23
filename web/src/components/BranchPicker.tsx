import { useRef, useState } from "react";
import { api, type GitRepoInfo, type GitBranchInfo } from "../api.js";

interface BranchPickerProps {
  gitRepoInfo: GitRepoInfo;
  worktreeBranch: string;
  onBranchSelect: (branch: string, isNew: boolean) => void;
}

export function BranchPicker({ gitRepoInfo, worktreeBranch, onBranchSelect }: BranchPickerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function openDropdown() {
    if (!showDropdown) {
      api.gitFetch(gitRepoInfo.repoRoot)
        .catch(() => {})
        .finally(() => {
          api.listBranches(gitRepoInfo.repoRoot).then(setBranches).catch(() => setBranches([]));
        });
    }
    setShowDropdown(!showDropdown);
    setBranchFilter("");
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={openDropdown}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors cursor-pointer text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
          <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.378A2.5 2.5 0 007.5 8h1a1 1 0 010 2h-1A2.5 2.5 0 005 12.5v.128a2.25 2.25 0 101.5 0V12.5a1 1 0 011-1h1a2.5 2.5 0 000-5h-1a1 1 0 01-1-1V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
        </svg>
        <span className="max-w-[100px] sm:max-w-[160px] truncate font-mono-code">
          {worktreeBranch || gitRepoInfo.currentBranch}
        </span>
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute left-0 bottom-full mb-1 w-72 max-w-[calc(100vw-2rem)] bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-10 overflow-hidden">
          <div className="px-2 py-2 border-b border-cc-border">
            <input
              type="text"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              placeholder="Filter or create branch..."
              className="w-full px-2 py-1 text-xs bg-cc-input-bg border border-cc-border rounded-md text-cc-fg font-mono-code placeholder:text-cc-muted focus:outline-none focus:border-cc-primary/50"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowDropdown(false);
              }}
            />
          </div>
          <BranchList
            branches={branches}
            filter={branchFilter}
            selected={worktreeBranch}
            onSelect={(branch, isNew) => {
              onBranchSelect(branch, isNew);
              setShowDropdown(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

interface BranchListProps {
  branches: GitBranchInfo[];
  filter: string;
  selected: string;
  onSelect: (branch: string, isNew: boolean) => void;
}

function BranchList({ branches, filter, selected, onSelect }: BranchListProps) {
  const f = filter.toLowerCase().trim();
  const localBranches = branches.filter((b) => !b.isRemote && (!f || b.name.toLowerCase().includes(f)));
  const remoteBranches = branches.filter((b) => b.isRemote && (!f || b.name.toLowerCase().includes(f)));
  const exactMatch = branches.some((b) => b.name.toLowerCase() === f);
  const hasResults = localBranches.length > 0 || remoteBranches.length > 0;

  return (
    <div className="max-h-[240px] overflow-y-auto py-1">
      {localBranches.length > 0 && (
        <>
          <div className="px-3 py-1 text-[10px] text-cc-muted uppercase tracking-wider">Local</div>
          {localBranches.map((b) => (
            <button
              key={b.name}
              onClick={() => onSelect(b.name, false)}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                b.name === selected ? "text-cc-primary font-medium" : "text-cc-fg"
              }`}
            >
              <span className="truncate font-mono-code">{b.name}</span>
              <span className="ml-auto flex items-center gap-1.5 shrink-0">
                {b.isCurrent && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400">current</span>
                )}
                {b.worktreePath && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">wt</span>
                )}
              </span>
            </button>
          ))}
        </>
      )}
      {remoteBranches.length > 0 && (
        <>
          <div className="px-3 py-1 text-[10px] text-cc-muted uppercase tracking-wider mt-1">Remote</div>
          {remoteBranches.map((b) => (
            <button
              key={`remote-${b.name}`}
              onClick={() => onSelect(b.name, false)}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                b.name === selected ? "text-cc-primary font-medium" : "text-cc-fg"
              }`}
            >
              <span className="truncate font-mono-code">{b.name}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-cc-hover text-cc-muted ml-auto shrink-0">remote</span>
            </button>
          ))}
        </>
      )}
      {!hasResults && f && (
        <div className="px-3 py-2 text-xs text-cc-muted text-center">No matching branches</div>
      )}
      {f && !exactMatch && (
        <div className="border-t border-cc-border mt-1 pt-1">
          <button
            onClick={() => onSelect(filter.trim(), true)}
            className="w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-primary"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
            </svg>
            <span>Create <span className="font-mono-code font-medium">{filter.trim()}</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
