import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store.js";
import { api, type CompanionEnv, type GitRepoInfo, type GitBranchInfo } from "../api.js";
import { connectSession, waitForConnection, sendToSession } from "../ws.js";
import { disconnectSession } from "../ws.js";
import { useVoiceInput } from "../hooks/use-voice-input.js";
import { useDictationFormatter } from "../hooks/use-dictation-formatter.js";
import { getRecentDirs, addRecentDir } from "../utils/recent-dirs.js";
import { EnvManager } from "./EnvManager.js";
import { FolderPicker } from "./FolderPicker.js";
import { detectProject, type ProjectInfo } from "../utils/project-detector.js";

interface ImageAttachment {
  name: string;
  base64: string;
  mediaType: string;
}

function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MODELS = [
  { value: "claude-opus-4-6", label: "Opus", icon: "\u2733" },
  { value: "claude-sonnet-4-5-20250929", label: "Sonnet", icon: "\u25D0" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku", icon: "\u26A1" },
];

const MODES = [
  { value: "bypassPermissions", label: "Bypass Permissions", desc: "Auto-approve all tool calls" },
  { value: "acceptEdits", label: "Accept Edits", desc: "Approve file changes only" },
  { value: "plan", label: "Plan", desc: "Plan before making changes" },
  { value: "default", label: "Manual", desc: "Approve every tool call" },
];

let idCounter = 0;

export function HomePage() {
  const [text, setText] = useState("");
  const [model, setModel] = useState(MODELS[0].value);
  const [mode, setMode] = useState(MODES[0].value);
  const [cwd, setCwd] = useState(() => getRecentDirs()[0] || "");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Environment state
  const [envs, setEnvs] = useState<CompanionEnv[]>([]);
  const [selectedEnv, setSelectedEnv] = useState(() => localStorage.getItem("cc-selected-env") || "");
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showEnvManager, setShowEnvManager] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input with AI formatting
  const formatter = useDictationFormatter();

  const handleVoiceTranscript = useCallback((transcript: string) => {
    formatter.addRawText(transcript);
  }, [formatter.addRawText]);

  const { isSupported: voiceSupported, isListening, interimText, start: startVoice, stop: stopVoice } =
    useVoiceInput(handleVoiceTranscript);

  // Stop voice, flush formatting, then commit formatted text
  const handleStopVoice = useCallback(async () => {
    stopVoice();
    const formatted = await formatter.flush();
    if (formatted) {
      setText((prev) => (prev ? prev + " " + formatted : formatted));
    }
    formatter.reset();
  }, [stopVoice, formatter]);

  // Show typed text + formatter voice text + interim speech
  const voiceDisplay = formatter.getDisplayText();
  const displayText = [text, voiceDisplay, isListening ? interimText : ""]
    .filter(Boolean).join(" ");

  // Dropdown states
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // Project detection
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  // Worktree state
  const [gitRepoInfo, setGitRepoInfo] = useState<GitRepoInfo | null>(null);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [isNewBranch, setIsNewBranch] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const currentSessionId = useStore((s) => s.currentSessionId);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Load server home/cwd on mount
  useEffect(() => {
    api.getHome().then(({ home, cwd: serverCwd }) => {
      if (!cwd) {
        setCwd(serverCwd || home);
      }
    }).catch(() => {});
    api.listEnvs().then(setEnvs).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
        setShowEnvDropdown(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Detect project when cwd changes
  useEffect(() => {
    if (!cwd) {
      setProjectInfo(null);
      return;
    }
    api.listDirs(cwd).then((result) => {
      const names = result.dirs.map((e) => e.name);
      setProjectInfo(detectProject(names, cwd));
    }).catch(() => setProjectInfo(null));
  }, [cwd]);

  // Detect git repo when cwd changes
  useEffect(() => {
    if (!cwd) {
      setGitRepoInfo(null);
      return;
    }
    api.getRepoInfo(cwd).then((info) => {
      setGitRepoInfo(info);
      setUseWorktree(false);
      setWorktreeBranch(info.currentBranch);
      setIsNewBranch(false);
      api.listBranches(info.repoRoot).then(setBranches).catch(() => setBranches([]));
    }).catch(() => {
      setGitRepoInfo(null);
    });
  }, [cwd]);

  // Fetch branches when git repo changes
  useEffect(() => {
    if (gitRepoInfo) {
      api.listBranches(gitRepoInfo.repoRoot).then(setBranches).catch(() => setBranches([]));
    }
  }, [gitRepoInfo]);


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

  // Auto-resize textarea when content changes (voice, text, etc.)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 300) + "px";
  }, [displayText]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const idx = MODES.findIndex((m) => m.value === mode);
      setMode(MODES[(idx + 1) % MODES.length].value);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    const voiceText = formatter.getDisplayText();
    const msg = [text, voiceText].filter(Boolean).join(" ").trim();
    if (!msg || sending) return;

    setSending(true);
    setError("");

    try {
      // Disconnect current session if any
      if (currentSessionId) {
        disconnectSession(currentSessionId);
      }

      // Create session (with optional worktree)
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

      // Assign "Pending" name until auto-namer renames it
      useStore.getState().setSessionName(sessionId, "Pending");

      // Save cwd to recent dirs
      if (cwd) addRecentDir(cwd);

      // Store the permission mode for this session
      useStore.getState().setPreviousPermissionMode(sessionId, mode);

      // Switch to session
      setCurrentSession(sessionId);
      connectSession(sessionId);

      // Wait for WebSocket connection
      await waitForConnection(sessionId);

      // Send message
      sendToSession(sessionId, {
        type: "user_message",
        content: msg,
        session_id: sessionId,
        images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
      });

      // Add user message to store
      useStore.getState().appendMessage(sessionId, {
        id: `user-${Date.now()}-${++idCounter}`,
        role: "user",
        content: msg,
        images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
        timestamp: Date.now(),
      });

      formatter.reset();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  }

  const canSend = (text.trim().length > 0 || formatter.getDisplayText().length > 0) && !sending;

  return (
    <div className="flex-1 h-full flex items-center justify-center px-3 sm:px-4">
      <div className="w-full max-w-2xl">
        {/* Logo + Title */}
        <div className="flex flex-col items-center justify-center mb-4 sm:mb-6">
          <img src="/logo.svg" alt="Claude Web CLI" className="w-24 h-24 sm:w-32 sm:h-32 mb-3" />
          <h1 className="text-xl sm:text-2xl font-semibold text-cc-fg">
            Claude Web CLI
          </h1>
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Input card */}
        <div className="bg-cc-card border border-cc-border rounded-[14px] shadow-sm overflow-hidden">
          <textarea
            ref={textareaRef}
            value={displayText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Fix a bug, build a feature, refactor code..."
            rows={4}
            className={`w-full px-4 pt-4 pb-2 text-sm bg-transparent resize-none focus:outline-none text-cc-fg font-sans-ui placeholder:text-cc-muted${(formatter.state.ghostText || interimText) ? " voice-ghost" : ""}`}
            style={{ minHeight: "100px", maxHeight: "300px" }}
          />

          {/* Bottom toolbar — matches Composer layout */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left: mode + model cycle buttons */}
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

            {/* Right: voice + image + send */}
            <div className="flex items-center gap-1">
              {voiceSupported && (
                <button
                  onClick={isListening ? handleStopVoice : startVoice}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    isListening
                      ? "text-cc-error hover:bg-cc-error/10 cursor-pointer"
                      : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                  }`}
                  title={isListening ? "Stop recording" : "Voice input"}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 ${isListening ? "animate-pulse" : ""}`}>
                    <path d="M8 1a2.5 2.5 0 00-2.5 2.5v4a2.5 2.5 0 005 0v-4A2.5 2.5 0 008 1zM5 7a.5.5 0 00-1 0 4 4 0 003.5 3.969V13H6a.5.5 0 000 1h4a.5.5 0 000-1H8.5v-2.031A4 4 0 0012 7a.5.5 0 00-1 0 3 3 0 01-6 0z" />
                  </svg>
                </button>
              )}
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
                  <span key={m} className="text-[9px] text-cc-muted bg-cc-hover px-1 py-0.5 rounded">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Branch picker (always visible when cwd is a git repo) */}
          {gitRepoInfo && (
            <div className="relative" ref={branchDropdownRef}>
              <button
                onClick={() => {
                  if (!showBranchDropdown && gitRepoInfo) {
                    api.gitFetch(gitRepoInfo.repoRoot)
                      .catch(() => {})
                      .finally(() => {
                        api.listBranches(gitRepoInfo.repoRoot).then(setBranches).catch(() => setBranches([]));
                      });
                  }
                  setShowBranchDropdown(!showBranchDropdown);
                  setBranchFilter("");
                }}
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
              {showBranchDropdown && (
                <div className="absolute left-0 bottom-full mb-1 w-72 max-w-[calc(100vw-2rem)] bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-10 overflow-hidden">
                  {/* Search/filter input */}
                  <div className="px-2 py-2 border-b border-cc-border">
                    <input
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter or create branch..."
                      className="w-full px-2 py-1 text-xs bg-cc-input-bg border border-cc-border rounded-md text-cc-fg font-mono-code placeholder:text-cc-muted focus:outline-none focus:border-cc-primary/50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setShowBranchDropdown(false);
                        }
                      }}
                    />
                  </div>
                  {/* Branch list */}
                  <div className="max-h-[240px] overflow-y-auto py-1">
                    {(() => {
                      const filter = branchFilter.toLowerCase().trim();
                      const localBranches = branches.filter((b) => !b.isRemote && (!filter || b.name.toLowerCase().includes(filter)));
                      const remoteBranches = branches.filter((b) => b.isRemote && (!filter || b.name.toLowerCase().includes(filter)));
                      const exactMatch = branches.some((b) => b.name.toLowerCase() === filter);
                      const hasResults = localBranches.length > 0 || remoteBranches.length > 0;

                      return (
                        <>
                          {/* Local branches */}
                          {localBranches.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-[10px] text-cc-muted uppercase tracking-wider">Local</div>
                              {localBranches.map((b) => (
                                <button
                                  key={b.name}
                                  onClick={() => {
                                    setWorktreeBranch(b.name);
                                    setIsNewBranch(false);
                                    setShowBranchDropdown(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                                    b.name === worktreeBranch ? "text-cc-primary font-medium" : "text-cc-fg"
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
                          {/* Remote branches */}
                          {remoteBranches.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-[10px] text-cc-muted uppercase tracking-wider mt-1">Remote</div>
                              {remoteBranches.map((b) => (
                                <button
                                  key={`remote-${b.name}`}
                                  onClick={() => {
                                    setWorktreeBranch(b.name);
                                    setIsNewBranch(false);
                                    setShowBranchDropdown(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                                    b.name === worktreeBranch ? "text-cc-primary font-medium" : "text-cc-fg"
                                  }`}
                                >
                                  <span className="truncate font-mono-code">{b.name}</span>
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-cc-hover text-cc-muted ml-auto shrink-0">remote</span>
                                </button>
                              ))}
                            </>
                          )}
                          {/* No results */}
                          {!hasResults && filter && (
                            <div className="px-3 py-2 text-xs text-cc-muted text-center">No matching branches</div>
                          )}
                          {/* Create new branch option */}
                          {filter && !exactMatch && (
                            <div className="border-t border-cc-border mt-1 pt-1">
                              <button
                                onClick={() => {
                                  setWorktreeBranch(branchFilter.trim());
                                  setIsNewBranch(true);
                                  setShowBranchDropdown(false);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-primary"
                              >
                                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                                </svg>
                                <span>Create <span className="font-mono-code font-medium">{branchFilter.trim()}</span></span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
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
          <div className="relative" ref={envDropdownRef}>
            <button
              onClick={() => {
                if (!showEnvDropdown) {
                  api.listEnvs().then(setEnvs).catch(() => {});
                }
                setShowEnvDropdown(!showEnvDropdown);
              }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-cc-muted hover:text-cc-fg rounded-md hover:bg-cc-hover transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
                <path d="M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z" />
              </svg>
              <span className="max-w-[120px] truncate">
                {selectedEnv ? envs.find((e) => e.slug === selectedEnv)?.name || "Env" : "No env"}
              </span>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {showEnvDropdown && (
              <div className="absolute left-0 bottom-full mb-1 w-56 bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-10 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    setSelectedEnv("");
                    localStorage.setItem("cc-selected-env", "");
                    setShowEnvDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer ${
                    !selectedEnv ? "text-cc-primary font-medium" : "text-cc-fg"
                  }`}
                >
                  No environment
                </button>
                {envs.map((env) => (
                  <button
                    key={env.slug}
                    onClick={() => {
                      setSelectedEnv(env.slug);
                      localStorage.setItem("cc-selected-env", env.slug);
                      setShowEnvDropdown(false);
                    }}
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
                    onClick={() => {
                      setShowEnvManager(true);
                      setShowEnvDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                  >
                    Manage environments...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Model moved to toolbar as cycle button */}
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

      {/* Environment manager modal */}
      {showEnvManager && (
        <EnvManager
          onClose={() => {
            setShowEnvManager(false);
            api.listEnvs().then(setEnvs).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
