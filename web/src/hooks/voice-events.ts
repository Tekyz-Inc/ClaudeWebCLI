/* ─── Voice Event Bus ─────────────────────────────────────────────
 * Module-level event emitter for speech/whisper monitoring.
 * Events are buffered at module level so they persist across
 * component mount/unmount (e.g., switching views).
 */

export type VoiceEventSource = "app" | "component";

export type VoiceEventType =
  | "speech-interim"
  | "speech-final"
  | "whisper-correction"
  | "whisper-status"
  | "engine-event";

export interface VoiceEvent {
  timestamp: number;
  source: VoiceEventSource;
  type: VoiceEventType;
  detail: string;
}

type VoiceEventCallback = (event: VoiceEvent) => void;

const MAX_EVENTS = 100;

const listeners: VoiceEventCallback[] = [];

/** Module-level event buffer — persists across component mounts. */
let eventBuffer: VoiceEvent[] = [];
let bufferVersion = 0;
type BufferCallback = () => void;
const bufferListeners: BufferCallback[] = [];

function notifyBufferListeners(): void {
  for (const cb of bufferListeners) cb();
}

export function emitVoiceEvent(
  event: Omit<VoiceEvent, "timestamp">,
): void {
  const full: VoiceEvent = { ...event, timestamp: Date.now() };

  // Add to persistent buffer
  eventBuffer.push(full);
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer = eventBuffer.slice(-MAX_EVENTS);
  }
  bufferVersion++;
  notifyBufferListeners();

  for (const cb of listeners) {
    cb(full);
  }
}

/** Subscribe to voice events. Returns an unsubscribe function. */
export function subscribeVoiceEvents(
  callback: VoiceEventCallback,
): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/** Get the current event buffer (persistent across mounts). */
export function getVoiceEvents(): VoiceEvent[] {
  return eventBuffer;
}

/** Get buffer version for change detection. */
export function getVoiceEventVersion(): number {
  return bufferVersion;
}

/** Clear the event buffer (manual clear only). */
export function clearVoiceEvents(): void {
  eventBuffer = [];
  bufferVersion++;
  notifyBufferListeners();
}

/** Subscribe to buffer changes. Returns unsubscribe function. */
export function subscribeVoiceBuffer(callback: BufferCallback): () => void {
  bufferListeners.push(callback);
  return () => {
    const idx = bufferListeners.indexOf(callback);
    if (idx >= 0) bufferListeners.splice(idx, 1);
  };
}
