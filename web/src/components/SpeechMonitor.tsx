import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import {
  getVoiceEvents,
  getVoiceEventVersion,
  clearVoiceEvents,
  subscribeVoiceBuffer,
  type VoiceEvent,
} from "../hooks/voice-events.js";

const SOURCE_LABEL: Record<string, string> = {
  "speech-interim": "WSAPI interim",
  "speech-final": "WSAPI final",
  "whisper-correction": "Whisper correction",
  "whisper-status": "Whisper status",
  "engine-event": "Engine",
};

export function SpeechMonitor() {
  // Read from persistent module-level buffer (survives remounts)
  const events = useSyncExternalStore(
    subscribeVoiceBuffer,
    getVoiceEvents,
  );
  const _version = useSyncExternalStore(
    subscribeVoiceBuffer,
    getVoiceEventVersion,
  );

  const [collapsed, setCollapsed] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [_version, collapsed]);

  const clear = useCallback(() => clearVoiceEvents(), []);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  };

  return (
    <div className="border-t border-cc-border text-[10px]">
      <div className="flex items-center justify-between px-2 py-0.5 bg-cc-bg-secondary">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-cc-muted hover:text-cc-fg flex items-center gap-1"
        >
          <span className={`transition-transform ${collapsed ? "" : "rotate-90"}`}>
            &#9654;
          </span>
          Speech Monitor
          {events.length > 0 && (
            <span className="text-cc-accent ml-1">({events.length})</span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={clear}
            className="text-cc-muted hover:text-cc-fg px-1"
          >
            Clear
          </button>
        )}
      </div>
      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-32 overflow-y-auto font-mono bg-cc-bg"
        >
          {events.length === 0 ? (
            <div className="px-2 py-1 text-cc-muted italic">
              No events yet — start recording to see events
            </div>
          ) : (
            events.map((ev: VoiceEvent, i: number) => (
              <div
                key={i}
                className="flex flex-wrap gap-1 px-2 py-px hover:bg-cc-bg-secondary border-b border-cc-border/20"
              >
                <span className="text-cc-muted shrink-0">
                  {formatTime(ev.timestamp)}
                </span>
                <span className="text-cc-accent shrink-0">
                  {SOURCE_LABEL[ev.type] || ev.type}
                </span>
                <span className="text-cc-fg break-all">
                  {ev.type.startsWith("speech-") ? `'${ev.detail}'` : ev.detail}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
