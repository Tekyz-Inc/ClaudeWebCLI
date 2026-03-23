import { useEffect, useRef, useMemo, useState } from "react";
import { useStore } from "../store.js";
import { MessageBubble } from "./MessageBubble.js";
import { ToolBlock, ToolIcon } from "./ToolBlock.js";
import { getToolIcon, getToolLabel } from "./tool-utils.js";
import type { ChatMessage, ContentBlock } from "../types.js";
import { groupMessages, type FeedEntry, type ToolMsgGroup, type SubagentGroup } from "../utils/toolGrouping.js";

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const EMPTY_MESSAGES: ChatMessage[] = [];

// ─── Components ──────────────────────────────────────────────────────────────

function ToolMessageGroup({ group }: { group: ToolMsgGroup }) {
  const [open, setOpen] = useState(false);
  const iconType = getToolIcon(group.toolName);
  const label = getToolLabel(group.toolName);
  const count = group.items.length;

  // Single item — render via ToolBlock for proper detail views (diff, syntax, etc.)
  if (count === 1) {
    const item = group.items[0];
    return (
      <div className="animate-[fadeSlideIn_0.2s_ease-out]">
        <div className="flex items-start gap-3">
          <AssistantAvatar />
          <div className="flex-1 min-w-0">
            <ToolBlock name={item.name} input={item.input} toolUseId={item.id} />
          </div>
        </div>
      </div>
    );
  }

  // Multi-item group — collapsible list, each item rendered via ToolBlock
  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="flex items-start gap-3">
        <AssistantAvatar />
        <div className="flex-1 min-w-0">
          <div className="border border-cc-border rounded-[10px] overflow-hidden bg-cc-card">
            <button
              onClick={() => setOpen(!open)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-cc-hover transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>
                <path d="M6 4l4 4-4 4" />
              </svg>
              <ToolIcon type={iconType} />
              <span className="text-xs font-medium text-cc-fg">{label}</span>
              <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 tabular-nums font-medium">
                {count}
              </span>
            </button>

            {open && (
              <div className="border-t border-cc-border px-3 py-2 space-y-2">
                {group.items.map((item, i) => (
                  <ToolBlock key={item.id || i} name={item.name} input={item.input} toolUseId={item.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedEntries({ entries }: { entries: FeedEntry[] }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (entry.kind === "tool_msg_group") {
          return <ToolMessageGroup key={entry.firstId || i} group={entry} />;
        }
        if (entry.kind === "subagent") {
          return <SubagentContainer key={entry.taskToolUseId} group={entry} />;
        }
        return <MessageBubble key={entry.msg.id} message={entry.msg} />;
      })}
    </>
  );
}

function SubagentContainer({ group }: { group: SubagentGroup }) {
  const [open, setOpen] = useState(false);
  const label = group.description || "Subagent";
  const agentType = group.agentType;
  const childCount = group.children.length;

  // Get the last visible entry for a compact preview
  const lastEntry = group.children[group.children.length - 1];
  const lastPreview = useMemo(() => {
    if (!lastEntry) return "";
    if (lastEntry.kind === "tool_msg_group") {
      const item = lastEntry.items[lastEntry.items.length - 1];
      return `${getToolLabel(lastEntry.toolName)}${lastEntry.items.length > 1 ? ` ×${lastEntry.items.length}` : ""}`;
    }
    if (lastEntry.kind === "message" && lastEntry.msg.role === "assistant") {
      const text = lastEntry.msg.content?.trim();
      if (text) return text.length > 60 ? text.slice(0, 60) + "..." : text;
      const toolBlock = lastEntry.msg.contentBlocks?.find(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
      );
      if (toolBlock) return getToolLabel(toolBlock.name);
    }
    return "";
  }, [lastEntry]);

  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="ml-9 border-l-2 border-cc-primary/20 pl-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 py-1.5 text-left cursor-pointer mb-1"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-cc-primary shrink-0">
            <circle cx="8" cy="8" r="5" />
            <path d="M8 5v3l2 1" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-medium text-cc-fg truncate">{label}</span>
          {agentType && (
            <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 shrink-0">
              {agentType}
            </span>
          )}
          {!open && lastPreview && (
            <span className="text-[11px] text-cc-muted truncate ml-1 font-mono-code">
              {lastPreview}
            </span>
          )}
          <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 tabular-nums shrink-0 ml-auto">
            {childCount}
          </span>
        </button>

        {open && (
          <div className="space-y-3 pb-2">
            <FeedEntries entries={group.children} />
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span className="text-cc-primary shrink-0 text-[11px] mt-[3px] select-none leading-none">●</span>
  );
}

// ─── Main Feed ───────────────────────────────────────────────────────────────

export function MessageFeed({ sessionId }: { sessionId: string }) {
  const messages = useStore((s) => s.messages.get(sessionId) ?? EMPTY_MESSAGES);
  const streamingText = useStore((s) => s.streaming.get(sessionId));
  const streamingStartedAt = useStore((s) => s.streamingStartedAt.get(sessionId));
  const streamingOutputTokens = useStore((s) => s.streamingOutputTokens.get(sessionId));
  const sessionStatus = useStore((s) => s.sessionStatus.get(sessionId));
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const [elapsed, setElapsed] = useState(0);

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  // Tick elapsed time every second while actively streaming; freeze once streaming stops
  const isFinishing = sessionStatus === "running" && !streamingText;
  useEffect(() => {
    if (!streamingStartedAt && sessionStatus !== "running") {
      setElapsed(0);
      return;
    }
    const start = streamingStartedAt || Date.now();
    setElapsed(Date.now() - start);
    // Stop ticking once streaming ends (waiting for result event)
    if (isFinishing) return;
    const interval = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(interval);
  }, [streamingStartedAt, sessionStatus, isFinishing]);

  // On session switch: reset near-bottom flag and jump to bottom immediately
  useEffect(() => {
    isNearBottom.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [sessionId]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    isNearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, streamingText]);

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none px-6">
        <div className="w-14 h-14 rounded-2xl bg-cc-card border border-cc-border flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-cc-muted">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm text-cc-fg font-medium mb-1">Start a conversation</p>
          <p className="text-xs text-cc-muted leading-relaxed">
            Send a message to begin working with Claude Web CLI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scroll-smooth px-1 py-2"
      >
        <div className="space-y-2">
          <FeedEntries entries={grouped} />

          {/* Streaming indicator */}
          {streamingText && (
            <div className="animate-[fadeSlideIn_0.2s_ease-out]">
              <div className="flex items-start gap-3">
                <span className="text-cc-primary shrink-0 text-[11px] mt-[3px] select-none leading-none">●</span>
                <div className="flex-1 min-w-0">
                  <pre className="font-serif-assistant text-[13px] text-cc-fg whitespace-pre-wrap break-words leading-snug">
                    {streamingText}
                    <span className="inline-block w-0.5 h-4 bg-cc-primary ml-0.5 align-middle animate-[pulse-dot_0.8s_ease-in-out_infinite]" />
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Generation stats bar */}
          {sessionStatus === "running" && elapsed > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-cc-muted font-mono-code pl-9">
              {isFinishing ? (
                <span className="opacity-40">Working...</span>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cc-primary animate-pulse" />
                  <span>Generating...</span>
                  <span className="text-cc-muted/60">(</span>
                  <span>{formatElapsed(elapsed)}</span>
                  {(streamingOutputTokens ?? 0) > 0 && (
                    <>
                      <span className="text-cc-muted/40">·</span>
                      <span>↓ {formatTokens(streamingOutputTokens!)}</span>
                    </>
                  )}
                  <span className="text-cc-muted/60">)</span>
                </>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
