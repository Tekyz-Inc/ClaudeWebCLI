import { useState, useRef, useCallback, useEffect } from "react";
import { STTEngine } from "@tekyzinc/stt-component";
import type { STTState, STTError } from "@tekyzinc/stt-component";
import type { UseVoiceReturn } from "./use-voice-input.js";

/* ─── Speech API types (for streaming preview) ────────── */

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent { error: string }
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    SpeechRecognitionCtor | null;
}

function checkWorkerSupport(): boolean {
  return typeof Worker !== "undefined";
}

/* ─── Hook: useVoiceInput (STTEngine + Speech API streaming) */

export function useVoiceInput(): UseVoiceReturn {
  const engineRef = useRef<STTEngine | null>(null);
  const initedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const accumulatedRef = useRef("");
  const isActiveRef = useRef(false);
  // After a correction, skip Speech API finals to prevent duplication.
  // Cleared when Speech API naturally restarts (onend).
  const skipFinalsRef = useRef(false);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const isSupported = checkWorkerSupport() || getSpeechRecognition() !== null;

  /* ─── Lazy engine creation ──────────────────────────── */

  const getEngine = useCallback((): STTEngine => {
    if (engineRef.current) return engineRef.current;
    const workerUrl = new URL(
      "../utils/stt-component-worker.ts",
      import.meta.url,
    );
    const engine = new STTEngine(undefined, workerUrl);
    engineRef.current = engine;

    engine.on("correction", (text: string) => {
      if (!isActiveRef.current) return;
      accumulatedRef.current = text.trim();
      setCorrectedText(text.trim());
      setInterimText(text.trim());
      // Skip Speech API finals until it naturally restarts (onend).
      // This prevents finals from the current session — which cover
      // audio Whisper already corrected — from being appended.
      // Interims still flow for streaming preview.
      skipFinalsRef.current = true;
    });

    engine.on("error", (err: STTError) => {
      setError(err.message);
    });

    engine.on("status", (state: STTState) => {
      setIsModelLoaded(state.isModelLoaded);
      setLoadProgress(state.loadProgress);
      setIsModelLoading(state.status === "loading");
      setIsProcessing(state.status === "processing");
    });

    return engine;
  }, []);

  /* ─── Speech API streaming preview ──────────────────── */

  const startSpeechPreview = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    accumulatedRef.current = "";
    skipFinalsRef.current = false;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let lastFinalIndex = -1;
    let lastFinalText = "";

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      if (recognitionRef.current !== recognition) return;
      let final_ = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          // Skip finals after a correction to prevent duplication.
          // Also skip already-processed indices.
          if (!skipFinalsRef.current && i > lastFinalIndex) {
            final_ += t;
            lastFinalIndex = i;
          }
        } else { interim += t; }
      }
      if (final_ && final_.trim() !== lastFinalText) {
        lastFinalText = final_.trim();
        accumulatedRef.current = accumulatedRef.current
          ? accumulatedRef.current + " " + final_.trim()
          : final_.trim();
        setInterimText(accumulatedRef.current);
      } else if (interim) {
        setInterimText(
          accumulatedRef.current
            ? accumulatedRef.current + " " + interim
            : interim,
        );
      }
    };

    recognition.onerror = () => {
      if (recognitionRef.current !== recognition) return;
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      if (isActiveRef.current) {
        // Fresh session — safe to accumulate finals again
        skipFinalsRef.current = false;
        try { recognition.start(); } catch { recognitionRef.current = null; }
      } else {
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { recognitionRef.current = null; }
  }, []);

  const stopSpeechPreview = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.stop();
    }
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
    isActiveRef.current = true;

    const doStart = async (): Promise<void> => {
      await initEngine();
      const engine = getEngine();
      setIsListening(true);
      try { startSpeechPreview(); } catch { /* preview is optional */ }
      try {
        await engine.start();
      } catch {
        setIsListening(false);
        isActiveRef.current = false;
      }
    };

    doStart().catch(() => {});
  }, [initEngine, getEngine, startSpeechPreview]);

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
    stopSpeechPreview();

    // Keep interimText visible during processing so the display
    // doesn't flash empty. Consumer calls clearState() after inserting text.

    const text = await engine.stop();
    return text;
  }, [stopSpeechPreview]);

  /* ─── Cleanup on unmount ───────────────────────────── */

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
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
