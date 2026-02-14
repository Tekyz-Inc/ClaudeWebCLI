import { useState, useRef, useCallback, useEffect } from "react";
import { useWhisper } from "./use-whisper.js";

/* ─── Web Speech API types ──────────────────────────────── */

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

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

/* ─── Constants ─────────────────────────────────────────── */

const PAUSE_THRESHOLD_MS = 5_000;
const FORCED_INTERVAL_MS = 10_000;

/* ─── Unified voice hook ────────────────────────────────── */

export interface UseVoiceReturn {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  interimText: string;
  hasCorrected: boolean;
  error: string | null;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadProgress: number;
  useWhisper: boolean;
  start: () => void;
  stop: () => Promise<string>;
}

type ActiveBackend = "whisper" | "speech" | null;

export function useVoiceInput(): UseVoiceReturn {
  const whisper = useWhisper();

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [hasCorrected, setHasCorrected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const accumulatedRef = useRef<string>("");
  const activeBackendRef = useRef<ActiveBackend>(null);
  const lastCorrectionRef = useRef<number>(0);
  const forcedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const correctionFnRef = useRef<() => void>(() => {});

  const hasSpeechApi = getSpeechRecognition() !== null;
  const canUseWhisper = whisper.state.isSupported;
  const isSupported = canUseWhisper || hasSpeechApi;
  const activeWhisper = canUseWhisper && whisper.state.isModelLoaded;

  /* ─── Mid-recording correction ────────────────────────── */

  const triggerCorrection = useCallback(async () => {
    if (activeBackendRef.current !== "whisper") return;
    if (!whisper.state.isModelLoaded) return;

    const now = Date.now();
    if (now - lastCorrectionRef.current < PAUSE_THRESHOLD_MS) return;

    whisper.cancelTranscription();
    lastCorrectionRef.current = now;

    const text = await whisper.transcribeSnapshot();
    if (activeBackendRef.current === "whisper" && text.trim()) {
      accumulatedRef.current = text.trim();
      setInterimText(text.trim());
      setHasCorrected(true);
    }
  }, [whisper]);

  // Keep ref in sync so onend closure can access latest version
  correctionFnRef.current = triggerCorrection;

  /* ─── Speech API helpers (used for streaming preview) ─── */

  const startSpeechPreview = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    accumulatedRef.current = "";
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
          if (i > lastFinalIndex) {
            final_ += t;
            lastFinalIndex = i;
          }
        } else {
          interim += t;
        }
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

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      if (activeBackendRef.current === "speech") {
        setError(e.error);
        setIsListening(false);
        activeBackendRef.current = null;
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;

      if (activeBackendRef.current === "speech") {
        setIsListening(false);
        activeBackendRef.current = null;
        setInterimText("");
        recognitionRef.current = null;
      } else if (activeBackendRef.current === "whisper") {
        // Speech API paused — trigger mid-recording correction via ref
        correctionFnRef.current();
        // Restart Speech API preview for continued streaming
        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
        }
      } else {
        setInterimText("");
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, []);

  const stopSpeechPreview = useCallback((): string => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.stop();
    }
    setInterimText("");
    const result = accumulatedRef.current;
    accumulatedRef.current = "";
    return result;
  }, []);

  /* ─── Timer helpers ──────────────────────────────────── */

  const startForcedTimer = useCallback(() => {
    if (forcedTimerRef.current) clearInterval(forcedTimerRef.current);
    forcedTimerRef.current = setInterval(() => {
      correctionFnRef.current();
    }, FORCED_INTERVAL_MS);
  }, []);

  const stopForcedTimer = useCallback(() => {
    if (forcedTimerRef.current) {
      clearInterval(forcedTimerRef.current);
      forcedTimerRef.current = null;
    }
  }, []);

  /* ─── Whisper path (with Speech API streaming preview) ── */

  const startWhisper = useCallback(async () => {
    setError(null);
    setInterimText("");
    setHasCorrected(false);
    setIsListening(true);
    activeBackendRef.current = "whisper";
    lastCorrectionRef.current = Date.now();

    try { startSpeechPreview(); } catch { /* preview is optional */ }

    startForcedTimer();
    await whisper.startRecording();
  }, [whisper, startSpeechPreview, startForcedTimer]);

  const stopWhisper = useCallback(async (): Promise<string> => {
    setIsListening(false);
    activeBackendRef.current = null;
    stopForcedTimer();
    whisper.cancelTranscription();

    const speechText = stopSpeechPreview();

    if (whisper.state.isModelLoaded) {
      setIsProcessing(true);
      const whisperText = await whisper.stopRecording();
      setIsProcessing(false);
      return whisperText || speechText;
    }

    whisper.cancelRecording();
    return speechText;
  }, [whisper, stopSpeechPreview, stopForcedTimer]);

  /* ─── Speech-only path (no Whisper available) ─────────── */

  const startSpeechOnly = useCallback(() => {
    setError(null);
    setInterimText("");
    setIsListening(true);
    activeBackendRef.current = "speech";
    startSpeechPreview();
  }, [startSpeechPreview]);

  const stopSpeechOnly = useCallback(async (): Promise<string> => {
    setIsListening(false);
    activeBackendRef.current = null;
    return stopSpeechPreview();
  }, [stopSpeechPreview]);

  /* ─── Unified interface ─────────────────────────────── */

  const start = useCallback(() => {
    if (canUseWhisper) {
      if (!whisper.state.isModelLoaded && !whisper.state.isModelLoading) {
        whisper.loadModel();
      }
      startWhisper().catch(() => {});
      return;
    }
    if (hasSpeechApi) {
      startSpeechOnly();
    }
  }, [canUseWhisper, hasSpeechApi, whisper, startWhisper, startSpeechOnly]);

  const stop = useCallback(async (): Promise<string> => {
    const backend = activeBackendRef.current;
    if (backend === "whisper") {
      return stopWhisper();
    }
    return stopSpeechOnly();
  }, [stopWhisper, stopSpeechOnly]);

  // Keep latest whisper ref for unmount cleanup
  const whisperRef = useRef(whisper);
  whisperRef.current = whisper;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (forcedTimerRef.current) {
        clearInterval(forcedTimerRef.current);
        forcedTimerRef.current = null;
      }
      whisperRef.current.cancelRecording();
    };
  }, []);

  return {
    isSupported,
    isListening,
    isProcessing: isProcessing || whisper.state.isTranscribing,
    interimText,
    hasCorrected,
    error: error || whisper.state.error,
    isModelLoaded: whisper.state.isModelLoaded,
    isModelLoading: whisper.state.isModelLoading,
    loadProgress: whisper.state.loadProgress,
    useWhisper: activeWhisper,
    start,
    stop,
  };
}
