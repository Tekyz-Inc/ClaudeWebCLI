import { useState, useRef, useEffect } from "react";
import { useStore } from "../store.js";
import { sendToSession } from "../ws.js";
import { api } from "../api.js";
import { usePromptHistory } from "../hooks/use-prompt-history.js";
import { requestNotificationPermission } from "../utils/notifications.js";
import { useImageAttachments } from "../hooks/useImageAttachments.js";
import { useDraftPersistence, setDraft } from "../hooks/useDraftPersistence.js";
import { useSlashMenu } from "../hooks/useSlashMenu.js";

let idCounter = 0;

const COMPOSER_MODES = [
  { value: "bypassPermissions", label: "Bypass" },
  { value: "dontAsk", label: "Don't Ask" },
  { value: "acceptEdits", label: "Accept Edits" },
  { value: "plan", label: "Plan" },
  { value: "default", label: "Manual" },
] as const;

export function Composer({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionData = useStore((s) => s.sessions.get(sessionId));
  const activeProjectCwd = useStore((s) => s.activeProjectCwd);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const streamingText = useStore((s) => s.streaming.get(sessionId));
  const hasQueued = useStore((s) => s.queuedMessages.has(sessionId));

  const { navigateUp, navigateDown, addToHistory, resetNavigation, saveDraft } =
    usePromptHistory(sessionId);

  const draftKey = activeProjectCwd ?? sessionId;
  const { draftKeyRef } = useDraftPersistence(draftKey, text, setText);

  const imageAttachments = useImageAttachments();
  const { images, setImages, isDragging, fileInputRef } = imageAttachments;

  const slashMenu = useSlashMenu(text, sessionData?.slash_commands, sessionData?.skills);
  const { slashMenuOpen, slashMenuIndex, setSlashMenuIndex, filteredCommands, menuRef } = slashMenu;

  const isConnected = cliConnected.get(sessionId) ?? false;
  const currentMode = sessionData?.permissionMode || "bypassPermissions";
  const isPlan = currentMode === "plan";
  const st = sessionStatus.get(sessionId);
  const isFinishing = st === "running" && !streamingText;
  const isRunning = (st === "running" && !!streamingText) || st === "submitted";
  const canSend = (text.trim().length > 0 || images.length > 0) && isConnected;

  // Auto-resize textarea when content changes
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  async function handleSend() {
    const msg = text.trim();
    if ((!msg && images.length === 0) || !isConnected) return;

    const sendPayload = {
      type: "user_message" as const,
      content: msg,
      session_id: sessionId,
      images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
    };

    if (isRunning || isFinishing) {
      useStore.getState().setQueuedMessage(sessionId, { content: msg, images: sendPayload.images });
    } else {
      sendToSession(sessionId, sendPayload);
      if (/^\/(clear|compact)\b/i.test(msg)) {
        useStore.getState().markClearOnNextResult(sessionId);
      }
      useStore.getState().setSessionStatus(sessionId, "submitted");
    }

    useStore.getState().appendMessage(sessionId, {
      id: `user-${Date.now()}-${++idCounter}`,
      role: "user",
      content: msg,
      images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
      timestamp: Date.now(),
    });

    addToHistory(msg);
    requestNotificationPermission();
    setDraft(draftKeyRef.current, "");
    setText("");
    setImages([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if ((e.key === "Tab" && !e.shiftKey) || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        slashMenu.selectCommand(filteredCommands[slashMenuIndex], setText, () => textareaRef.current?.focus());
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        slashMenu.closeMenu(text);
        return;
      }
    }

    if (e.key === "ArrowUp" && !slashMenuOpen) {
      const ta = textareaRef.current;
      if (ta && ta.selectionStart === 0) {
        saveDraft(text);
        const prev = navigateUp();
        if (prev !== null) { e.preventDefault(); setText(prev); }
        return;
      }
    }
    if (e.key === "ArrowDown" && !slashMenuOpen) {
      const ta = textareaRef.current;
      if (ta && ta.selectionStart === ta.value.length) {
        const next = navigateDown();
        if (next !== null) { e.preventDefault(); setText(next); }
        return;
      }
    }

    if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); cycleMode(); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function cycleMode() {
    if (!isConnected) return;
    const idx = COMPOSER_MODES.findIndex((m) => m.value === currentMode);
    const next = COMPOSER_MODES[(idx + 1) % COMPOSER_MODES.length];
    sendToSession(sessionId, { type: "set_permission_mode", mode: next.value });
    useStore.getState().updateSession(sessionId, { permissionMode: next.value });
  }

  return (
    <div
      className="shrink-0 border-t border-cc-border bg-cc-card px-2 sm:px-4 py-2 sm:py-3 relative"
      onDragEnter={imageAttachments.handleDragEnter}
      onDragLeave={imageAttachments.handleDragLeave}
      onDragOver={imageAttachments.handleDragOver}
      onDrop={imageAttachments.handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-cc-card/80 border-2 border-dashed border-cc-primary rounded-lg pointer-events-none">
          <span className="text-sm font-medium text-cc-primary">Drop files here</span>
        </div>
      )}
      <div className="max-w-3xl mx-auto">
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
                  onClick={() => imageAttachments.removeImage(i)}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={imageAttachments.handleFileSelect}
          className="hidden"
        />

        <div className={`relative bg-cc-input-bg border rounded-[14px] overflow-visible transition-colors ${
          isPlan ? "border-cc-primary/40" : "border-cc-border focus-within:border-cc-primary/30"
        }`}>
          {slashMenuOpen && filteredCommands.length > 0 && (
            <div
              ref={menuRef}
              className="absolute left-2 right-2 bottom-full mb-1 max-h-[320px] overflow-y-auto bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-20 py-0.5"
            >
              {filteredCommands.map((cmd, i) => (
                <button
                  key={`${cmd.type}-${cmd.name}`}
                  data-cmd-index={i}
                  onClick={() => slashMenu.selectCommand(cmd, setText, () => textareaRef.current?.focus())}
                  className={`w-full px-3 py-1 text-left flex items-center gap-2 transition-colors cursor-pointer ${
                    i === slashMenuIndex ? "bg-cc-hover" : "hover:bg-cc-hover/50"
                  }`}
                >
                  <span className="text-[11px] font-medium text-cc-fg shrink-0">/{cmd.name}</span>
                  {cmd.argumentHint && (
                    <span className="text-[10px] text-cc-primary/60 shrink-0">{cmd.argumentHint}</span>
                  )}
                  {cmd.description && (
                    <span className="text-[10px] text-cc-muted truncate">{cmd.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={imageAttachments.handlePaste}
              placeholder={isConnected ? "Type a message... (/ for commands)" : "Waiting for CLI connection..."}
              disabled={!isConnected}
              rows={1}
              className="w-full px-4 pt-3 pb-1 text-sm bg-transparent resize-none focus:outline-none text-cc-fg font-sans-ui placeholder:text-cc-muted/50 placeholder:italic disabled:opacity-50"
              style={{ minHeight: "36px", maxHeight: "200px" }}
            />
          </div>

          {sessionData?.git_branch && (
            <div className="flex items-center gap-2 px-2 sm:px-4 pb-1 text-[11px] text-cc-muted overflow-hidden">
              <span className="flex items-center gap-1 truncate min-w-0">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 opacity-60">
                  <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.116.862a2.25 2.25 0 10-.862.862A4.48 4.48 0 007.25 7.5h-1.5A2.25 2.25 0 003.5 9.75v.318a2.25 2.25 0 101.5 0V9.75a.75.75 0 01.75-.75h1.5a5.98 5.98 0 003.884-1.435A2.25 2.25 0 109.634 3.362zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                </svg>
                <span className="truncate max-w-[100px] sm:max-w-[160px]">{sessionData.git_branch}</span>
                {sessionData.is_worktree && (
                  <span className="text-[10px] bg-cc-primary/10 text-cc-primary px-1 rounded">worktree</span>
                )}
              </span>
              {((sessionData.git_ahead || 0) > 0 || (sessionData.git_behind || 0) > 0) && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  {(sessionData.git_ahead || 0) > 0 && <span className="text-green-500">{sessionData.git_ahead}&#8593;</span>}
                  {(sessionData.git_behind || 0) > 0 && (
                    <button
                      className="text-cc-warning hover:text-amber-400 cursor-pointer hover:underline"
                      title="Pull latest changes"
                      onClick={() => {
                        const cwd = sessionData.repo_root || sessionData.cwd;
                        if (!cwd) return;
                        api.gitPull(cwd).then((r) => {
                          useStore.getState().updateSession(sessionId, {
                            git_ahead: r.git_ahead,
                            git_behind: r.git_behind,
                          });
                          if (!r.success) console.warn("[git pull]", r.output);
                        }).catch((e) => console.error("[git pull]", e));
                      }}
                    >
                      {sessionData.git_behind}&#8595;
                    </button>
                  )}
                </span>
              )}
              {((sessionData.total_lines_added || 0) > 0 || (sessionData.total_lines_removed || 0) > 0) && (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-green-500">+{sessionData.total_lines_added || 0}</span>
                  <span className="text-red-400">-{sessionData.total_lines_removed || 0}</span>
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <button
              onClick={cycleMode}
              disabled={!isConnected}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer select-none ${
                !isConnected
                  ? "opacity-30 cursor-not-allowed text-cc-muted"
                  : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
              }`}
              title="Cycle permission mode (Shift+Tab)"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              <span>{COMPOSER_MODES.find((m) => m.value === currentMode)?.label || "Bypass"}</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isConnected}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  isConnected
                    ? "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                    : "text-cc-muted opacity-30 cursor-not-allowed"
                }`}
                title="Attach file"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              </button>

              {(isRunning || isFinishing) && (
                <button
                  onClick={() => sendToSession(sessionId, { type: "interrupt" })}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-cc-error/10 hover:bg-cc-error/20 text-cc-error transition-colors cursor-pointer"
                  title="Stop generation"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  !canSend
                    ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                    : hasQueued && (isRunning || isFinishing)
                    ? "bg-cc-warning hover:bg-cc-warning/80 text-white cursor-pointer"
                    : "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer"
                }`}
                title={
                  isRunning || isFinishing
                    ? hasQueued ? "Replace queued message" : "Queue message"
                    : "Send message"
                }
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M3 2l11 6-11 6V9.5l7-1.5-7-1.5V2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
