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

/* ─── Unified voice hook ────────────────────────────────── */

export interface UseVoiceReturn {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  interimText: string;
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
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const accumulatedRef = useRef<string>("");
  const activeBackendRef = useRef<ActiveBackend>(null);

  const hasSpeechApi = getSpeechRecognition() !== null;
  const canUseWhisper = whisper.state.isSupported;
  const isSupported = canUseWhisper || hasSpeechApi;
  const activeWhisper = canUseWhisper && whisper.state.isModelLoaded;

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
      // Ignore results from stale recognition instances
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
      // Ignore onend from stale recognition instances
      if (recognitionRef.current !== recognition) return;

      if (activeBackendRef.current === "speech") {
        setIsListening(false);
        activeBackendRef.current = null;
        setInterimText("");
        recognitionRef.current = null;
      } else if (activeBackendRef.current === "whisper") {
        // Speech API preview ended while Whisper still recording — restart
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
      recognitionRef.current = null; // Clear ref first so onend won't restart
      rec.stop();
    }
    setInterimText("");
    const result = accumulatedRef.current;
    accumulatedRef.current = "";
    return result;
  }, []);

  /* ─── Whisper path (with Speech API streaming preview) ── */

  const startWhisper = useCallback(async () => {
    setError(null);
    setInterimText("");
    setIsListening(true);
    activeBackendRef.current = "whisper";

    // Start Speech API for streaming preview (non-fatal if it fails)
    try { startSpeechPreview(); } catch { /* preview is optional */ }

    // Start Whisper audio capture (may await mic permission)
    await whisper.startRecording();
  }, [whisper, startSpeechPreview]);

  const stopWhisper = useCallback(async (): Promise<string> => {
    setIsListening(false);
    activeBackendRef.current = null;

    // Stop Speech API preview — get its text as fallback
    const speechText = stopSpeechPreview();

    // If model loaded, use Whisper for corrected transcription
    if (whisper.state.isModelLoaded) {
      setIsProcessing(true);
      const whisperText = await whisper.stopRecording();
      setIsProcessing(false);
      return whisperText || speechText;
    }

    // Model not loaded yet — cancel raw capture, use Speech API text
    whisper.cancelRecording();
    return speechText;
  }, [whisper, stopSpeechPreview]);

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
      // Auto-load model on first mic click
      if (!whisper.state.isModelLoaded && !whisper.state.isModelLoading) {
        whisper.loadModel();
      }
      // Always use whisper path (Speech API preview + raw capture)
      // so Whisper can correct text when model finishes loading
      startWhisper().catch(() => {});
      return;
    }
    // Fallback: no Whisper support at all
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

  // Keep latest whisper ref for unmount cleanup (avoids re-running on every render)
  const whisperRef = useRef(whisper);
  whisperRef.current = whisper;

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      whisperRef.current.cancelRecording();
    };
  }, []);

  return {
    isSupported,
    isListening,
    isProcessing: isProcessing || whisper.state.isTranscribing,
    interimText,
    error: error || whisper.state.error,
    isModelLoaded: whisper.state.isModelLoaded,
    isModelLoading: whisper.state.isModelLoading,
    loadProgress: whisper.state.loadProgress,
    useWhisper: activeWhisper,
    start,
    stop,
  };
}
