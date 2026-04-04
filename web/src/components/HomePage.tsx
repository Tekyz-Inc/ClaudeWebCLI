import { useState, useRef, useEffect } from "react";
import { useStore } from "../store.js";
import { api, type CompanionEnv, type GitRepoInfo } from "../api.js";
import { connectSession, waitForConnection, sendToSession } from "../ws.js";
import { disconnectSession } from "../ws.js";
import { getRecentDirs, addRecentDir } from "../utils/recent-dirs.js";
import { EnvManager } from "./EnvManager.js";
import { FolderPicker } from "./FolderPicker.js";
import { BranchPicker } from "./BranchPicker.js";
import { EnvSelector } from "./EnvSelector.js";
import { detectProject, type ProjectInfo } from "../utils/project-detector.js";
import { type ImageAttachment, readFileAsBase64 } from "../utils/imageUtils.js";

const MODELS = [
  { value: "claude-opus-4-6", label: "Opus", icon: "\u2733" },
  { value: "claude-sonnet-4-6", label: "Sonnet", icon: "\u25D0" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku", icon: "\u26A1" },
];

const MODES = [
  { value: "bypassPermissions", label: "Bypass Permissions", desc: "Auto-approve all tool calls" },
  { value: "dontAsk", label: "Don't Ask", desc: "Use allow/deny rules from settings" },
  { value: "acceptEdits", label: "Accept Edits", desc: "Approve file changes only" },
  { value: "plan", label: "Plan", desc: "Plan before making changes" },
  { value: "default", label: "Manual", desc: "Approve every tool call" },
];

let idCounter = 0;

export function HomePage() {
  const [text, setText] = useState("");
  const [model, setModel] = useState(MODELS[1].value);
  const [mode, setMode] = useState(MODES[0].value);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [cwd, setCwd] = useState(() => getRecentDirs()[0] || "");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Environment state
  const [envs, setEnvs] = useState<CompanionEnv[]>([]);
  const [selectedEnv, setSelectedEnv] = useState(() => localStorage.getItem("cc-selected-env") || "");
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // Project detection
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  // Worktree state
  const [gitRepoInfo, setGitRepoInfo] = useState<GitRepoInfo | null>(null);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [isNewBranch, setIsNewBranch] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const currentSessionId = useStore((s) => s.currentSessionId);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Load server home/cwd and global Claude settings on mount
  useEffect(() => {
    api.getHome().then(({ home, cwd: serverCwd }) => {
      if (!cwd) setCwd(serverCwd || home);
    }).catch(() => {});
    api.listEnvs().then(setEnvs).catch(() => {});
    // Apply user's default permission mode and model from ~/.claude/settings.json
    if (!settingsLoaded) {
      fetch("/api/claude-settings").then((r) => r.json()).then((data) => {
        if (data.defaultPermissionMode) {
          const match = MODES.find((m) => m.value === data.defaultPermissionMode);
          if (match) setMode(match.value);
        }
        if (data.defaultModel) {
          const modelMatch = MODELS.find((m) => m.value === data.defaultModel);
          if (modelMatch) setModel(modelMatch.value);
        }
        setSettingsLoaded(true);
      }).catch(() => setSettingsLoaded(true));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect project when cwd changes
  useEffect(() => {
    if (!cwd) { setProjectInfo(null); return; }
    api.listDirs(cwd).then((result) => {
      const names = result.dirs.map((e) => e.name);
      setProjectInfo(detectProject(names, cwd));
    }).catch(() => setProjectInfo(null));
  }, [cwd]);

  // Detect git repo when cwd changes
  useEffect(() => {
    if (!cwd) { setGitRepoInfo(null); return; }
    api.getRepoInfo(cwd).then((info) => {
      setGitRepoInfo(info);
      setUseWorktree(false);
      setWorktreeBranch(info.currentBranch);
      setIsNewBranch(false);
    }).catch(() => setGitRepoInfo(null));
  }, [cwd]);

  // Auto-resize textarea when content changes
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 300) + "px";
  }, [text]);

  const selectedModel = MODELS.find((m) => m.value === model) || MODELS[0];
  const selectedMode = MODES.find((m) => m.value === mode) || MODES[0];
  const dirLabel = cwd ? cwd.split("/").pop() || cwd : "Select folder";

  function cycleMode() {
    const idx = MODES.findIndex((m) => m.value === mode);
    setMode(MODES[(idx + 1) % MODES.length].value);
  }

  function cycleModel() {
    const idx = MODELS.findIndex((m) => m.value === model);
    setModel(MODELS[(idx + 1) % MODELS.length].value);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: file.name, base64, mediaType });
    }
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newImages: ImageAttachment[] = [];
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: `pasted-${Date.now()}.${file.type.split("/")[1]}`, base64, mediaType });
    }
    if (newImages.length > 0) {
      e.preventDefault();
      setImages((prev) => [...prev, ...newImages]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      cycleMode();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;

    setSending(true);
    setError("");

    try {
      if (currentSessionId) disconnectSession(currentSessionId);

      const branchName = worktreeBranch.trim() || undefined;
      const result = await api.createSession({
        model,
        permissionMode: mode,
        cwd: cwd || undefined,
        envSlug: selectedEnv || undefined,
        branch: branchName,
        createBranch: branchName && isNewBranch ? true : undefined,
        useWorktree: useWorktree || undefined,
      });
      const sessionId = result.sessionId;

      useStore.getState().setSessionName(sessionId, "Pending");
      if (cwd) addRecentDir(cwd);
      useStore.getState().setPreviousPermissionMode(sessionId, mode);

      setCurrentSession(sessionId);
      connectSession(sessionId);
      await waitForConnection(sessionId);

      const imagePayload = images.length > 0
        ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 }))
        : undefined;

      sendToSession(sessionId, {
        type: "user_message",
        content: msg,
        session_id: sessionId,
        images: imagePayload,
      });

      useStore.getState().appendMessage(sessionId, {
        id: `user-${Date.now()}-${++idCounter}`,
        role: "user",
        content: msg,
        images: imagePayload,
        timestamp: Date.now(),
      });

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  }

  const canSend = text.trim().length > 0 && !sending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center px-3 sm:px-4">
        <div className="w-full max-w-2xl">
          {/* Logo + Title */}
          <div className="flex flex-col items-center justify-center mb-4 sm:mb-6">
            <img src="/logo.svg" alt="Claude Web CLI" className="w-24 h-24 sm:w-32 sm:h-32 mb-3" />
            <h1 className="text-xl sm:text-2xl font-semibold text-cc-fg">Claude Web CLI</h1>
          </div>

          {/* Image thumbnails */}
          {images.length > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={`data:${img.mediaType};base64,${img.base64}`}
                    alt={img.name}
                    className="w-12 h-12 rounded-lg object-cover border border-cc-border"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cc-error text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

          {/* Input card */}
          <div className="bg-cc-card border border-cc-border rounded-[14px] shadow-sm overflow-hidden">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Fix a bug, build a feature, refactor code..."
                rows={4}
                className="w-full px-4 pt-4 pb-2 text-sm bg-transparent resize-none focus:outline-none text-cc-fg font-sans-ui placeholder:text-cc-muted"
                style={{ minHeight: "100px", maxHeight: "300px" }}
              />
            </div>

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={cycleMode}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-all cursor-pointer select-none"
                  title="Cycle permission mode (Shift+Tab)"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                  <span>{selectedMode.label}</span>
                </button>
                <button
                  onClick={cycleModel}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-all cursor-pointer select-none"
                  title="Cycle model"
                >
                  <span>{selectedModel.icon}</span>
                  <span>{selectedModel.label}</span>
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                  title="Attach file"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    canSend
                      ? "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer"
                      : "bg-cc-hover text-cc-muted cursor-not-allowed"
                  }`}
                  title="Send message"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M3 2l11 6-11 6V9.5l7-1.5-7-1.5V2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Below-card selectors */}
          <div className="flex items-center gap-1 sm:gap-2 mt-2 sm:mt-3 px-1 flex-wrap overflow-x-auto">
            {/* Folder selector */}
            <div>
              <button
                onClick={() => setShowFolderPicker(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-cc-muted hover:text-cc-fg rounded-md hover:bg-cc-hover transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
                  <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                </svg>
                <span className="max-w-[120px] sm:max-w-[200px] truncate font-mono-code">{dirLabel}</span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              {showFolderPicker && (
                <FolderPicker
                  initialPath={cwd || ""}
                  onSelect={(path) => { setCwd(path); }}
                  onClose={() => setShowFolderPicker(false)}
                />
              )}
              {projectInfo && (
                <div className="flex items-center gap-1.5 mt-1 px-2">
                  <span className="text-[10px] font-medium text-cc-primary bg-cc-primary/10 px-1.5 py-0.5 rounded">
                    {projectInfo.type}
                  </span>
                  <span className="text-[10px] text-cc-muted truncate max-w-[140px]">{projectInfo.name}</span>
                  {projectInfo.markers.map((m) => (
                    <span key={m} className="text-[9px] text-cc-muted bg-cc-hover px-1 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Branch picker (only when cwd is a git repo) */}
            {gitRepoInfo && (
              <BranchPicker
                gitRepoInfo={gitRepoInfo}
                worktreeBranch={worktreeBranch}
                onBranchSelect={(branch, isNew) => {
                  setWorktreeBranch(branch);
                  setIsNewBranch(isNew);
                }}
              />
            )}

            {/* Worktree toggle (only when cwd is a git repo) */}
            {gitRepoInfo && (
              <button
                onClick={() => setUseWorktree(!useWorktree)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                  useWorktree
                    ? "bg-cc-primary/15 text-cc-primary font-medium"
                    : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                }`}
                title="Create an isolated worktree for this session"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-70">
                  <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v5.256a2.25 2.25 0 101.5 0V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zm7.5-9.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V7A2.5 2.5 0 0110 9.5H6a1 1 0 000 2h4a2.5 2.5 0 012.5 2.5v.628a2.25 2.25 0 11-1.5 0V14a1 1 0 00-1-1H6a2.5 2.5 0 01-2.5-2.5V10a2.5 2.5 0 012.5-2.5h4a1 1 0 001-1V5.372a2.25 2.25 0 01-1.5-2.122z" />
                </svg>
                <span>Worktree</span>
              </button>
            )}

            {/* Environment selector */}
            <EnvSelector
              envs={envs}
              selectedEnv={selectedEnv}
              onSelect={setSelectedEnv}
              onManage={() => setShowEnvManager(true)}
              onOpen={() => api.listEnvs().then(setEnvs).catch(() => {})}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-cc-error/5 border border-cc-error/20">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-cc-error shrink-0">
                <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm1-3a1 1 0 11-2 0 1 1 0 012 0zM7.5 5.5a.5.5 0 011 0v3a.5.5 0 01-1 0v-3z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-cc-error">{error}</p>
            </div>
          )}
        </div>

        {showEnvManager && (
          <EnvManager
            onClose={() => {
              setShowEnvManager(false);
              api.listEnvs().then(setEnvs).catch(() => {});
            }}
          />
        )}
      </div>
    </div>
  );
}
