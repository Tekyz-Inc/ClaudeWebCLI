import { useState, useRef, useCallback, useEffect } from "react";
import { STTEngine } from "@tekyzinc/stt-component";
import type { STTState, STTError } from "@tekyzinc/stt-component";
import { emitVoiceEvent } from "./voice-events.js";

/* ─── Voice input hook (STTEngine-based) ────────────────
 * STTEngine handles everything:
 *   - Mic capture + audio buffering
 *   - Whisper transcription + corrections (via Web Worker)
 *   - Streaming text preview (via internal Web Speech API)
 *
 * Events:
 *   transcript → real-time interim text (streaming preview)
 *   correction → Whisper-corrected accumulated text
 *   status     → engine lifecycle (loading, recording, etc.)
 *   error      → actionable errors
 */

export interface UseVoiceReturn {
  isSupported: boolean;
  isListening: boolean;
  isStarting: boolean;
  isProcessing: boolean;
  interimText: string;
  correctedText: string;
  error: string | null;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadProgress: number;
  useWhisper: boolean;
  start: () => void;
  stop: () => Promise<string>;
  clearState: () => void;
}

function checkWorkerSupport(): boolean {
  return typeof Worker !== "undefined";
}

export function useVoiceInput(): UseVoiceReturn {
  const engineRef = useRef<STTEngine | null>(null);
  const initedRef = useRef(false);
  const isActiveRef = useRef(false);
  // Tracks the last Whisper correction received during recording.
  // Used as fallback return value in stop() when engine transcription times out.
  const correctedTextRef = useRef("");

  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const isSupported = checkWorkerSupport();

  /* ─── Lazy engine creation ──────────────────────────── */

  const getEngine = useCallback((): STTEngine => {
    if (engineRef.current) return engineRef.current;
    const workerUrl = new URL(
      "../utils/stt-component-worker.ts",
      import.meta.url,
    );
    // Increase forcedInterval from the default 3 s to 10 s.
    // With the default 3 s interval, `performCorrection()` calls
    // `workerManager.cancel()` every 3 s.  Whisper on CPU/WASM typically takes
    // 3–10 s per clip, so the result is cancelled before it can resolve and
    // the `correction` event never fires.  10 s gives Whisper enough headroom
    // to finish.  The pause-based correction (pauseThreshold: 1.5 s) still
    // fires quickly whenever the user stops speaking briefly.
    const engine = new STTEngine(
      { correction: { forcedInterval: 10_000, pauseThreshold: 1_500 } },
      workerUrl,
    );
    engineRef.current = engine;

    // Streaming preview — engine's SpeechStreamingManager already
    // accumulates Speech API finals internally, so the text param
    // is the full accumulated transcript (finals + current interim).
    // Show it directly — no prepending needed.
    engine.on("transcript", (text: string) => {
      if (!isActiveRef.current) return;
      setInterimText(text);
      emitVoiceEvent({ source: "app", type: "speech-interim", detail: text });
    });

    // Whisper correction — higher-quality replacement for the
    // Speech API text. Update both correctedText (for overlay styling)
    // and interimText (ensures display stays populated even if Speech
    // API is between restarts when the correction arrives).
    engine.on("correction", (text: string) => {
      if (!isActiveRef.current) return;
      const trimmed = text.trim();
      correctedTextRef.current = trimmed;
      setCorrectedText(trimmed);
      setInterimText(trimmed);
      emitVoiceEvent({
        source: "app",
        type: "whisper-correction",
        detail: trimmed,
      });
    });

    engine.on("error", (err: STTError) => {
      setError(err.message);
      emitVoiceEvent({
        source: "app",
        type: "whisper-status",
        detail: `ERROR: ${err.code} — ${err.message}`,
      });
    });

    // v0.2.3 debug events — SSM lifecycle logs to SpeechMonitor.
    // "debug" is not in the public STTEvents type, so cast to access it.
    (engine as unknown as { on(e: string, fn: (m: string) => void): void })
      .on("debug", (msg: string) => {
        emitVoiceEvent({ source: "app", type: "whisper-status", detail: msg });
      });

    engine.on("status", (state: STTState) => {
      setIsModelLoaded(state.isModelLoaded);
      setLoadProgress(state.loadProgress);
      setIsModelLoading(state.status === "loading");
      setIsProcessing(state.status === "processing");
      if (state.status !== "loading") {
        emitVoiceEvent({
          source: "app",
          type: "whisper-status",
          detail: `status: ${state.status}`,
        });
      }
    });

    return engine;
  }, []);

  /* ─── Init engine (once) ───────────────────────────── */

  const initEngine = useCallback(async (): Promise<void> => {
    if (initedRef.current) return;
    initedRef.current = true;
    const engine = getEngine();
    try {
      await engine.init();
    } catch {
      initedRef.current = false;
    }
  }, [getEngine]);

  /* ─── Start recording ──────────────────────────────── */

  const start = useCallback(() => {
    setError(null);
    setInterimText("");
    setCorrectedText("");
    correctedTextRef.current = "";
    isActiveRef.current = true;

    // Check engine's actual state — not just a ref flag.
    // When "ready", we can call engine.start() synchronously
    // to preserve user gesture context (required for Chrome's
    // SpeechRecognition.start()). Any preceding `await` breaks
    // the gesture chain, causing silent streaming failure.
    const engine = engineRef.current;
    if (engine && engine.getState().status === "ready") {
      setIsListening(true);
      engine.start().catch(() => {
        setIsListening(false);
        isActiveRef.current = false;
      });
    } else {
      // Engine not ready — async init + start (first recording).
      // SpeechRecognition won't activate (user gesture lost after
      // await), but Whisper corrections will still work.
      setIsStarting(true);
      const doStart = async (): Promise<void> => {
        await initEngine();
        const eng = getEngine();
        setIsStarting(false);
        setIsListening(true);
        try {
          await eng.start();
        } catch {
          setIsListening(false);
          isActiveRef.current = false;
        }
      };
      doStart().catch(() => {
        setIsStarting(false);
        isActiveRef.current = false;
      });
    }
  }, [initEngine, getEngine]);

  /* ─── Clear state (called by consumer after inserting text) */

  const clearState = useCallback(() => {
    setInterimText("");
    setCorrectedText("");
    setIsProcessing(false);
  }, []);

  /* ─── Stop recording ───────────────────────────────── */

  const stop = useCallback(async (): Promise<string> => {
    const engine = engineRef.current;
    if (!engine) return "";

    isActiveRef.current = false;
    setIsListening(false);
    setIsProcessing(true);

    // After page idle, Chrome throttles the correction timers, letting the
    // audio buffer grow unboundedly. It also throttles the Whisper worker,
    // causing engine.stop() to hang for 20-30 seconds. We cap the wait at
    // 2 s — if it times out, the engine is in a bad state so we destroy it
    // so the next recording starts fresh with a clean worker.
    let timedOut = false;
    const text = await Promise.race([
      engine.stop(),
      new Promise<string>((resolve) =>
        setTimeout(() => { timedOut = true; resolve(""); }, 2000)
      ),
    ]);

    if (timedOut) {
      engine.destroy();
      engineRef.current = null;
      initedRef.current = false;
    }

    return text;
  }, []);

  /* ─── Cleanup on unmount ───────────────────────────── */

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      initedRef.current = false;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    isStarting,
    isProcessing,
    interimText,
    correctedText,
    error,
    isModelLoaded,
    isModelLoading,
    loadProgress,
    useWhisper: isModelLoaded,
    start,
    stop,
    clearState,
  };
}
