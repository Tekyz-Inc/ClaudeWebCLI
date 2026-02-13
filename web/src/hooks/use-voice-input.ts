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
        setInterimText("");
      } else if (interim) {
        setInterimText(interim);
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // In hybrid mode, Speech API errors are non-fatal — Whisper is primary
      if (activeBackendRef.current === "speech") {
        setError(e.error);
        setIsListening(false);
        activeBackendRef.current = null;
      }
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (activeBackendRef.current === "speech") {
        setIsListening(false);
        activeBackendRef.current = null;
      }
      setInterimText("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopSpeechPreview = useCallback((): string => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
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

    // Start Speech API first for immediate streaming text preview
    startSpeechPreview();

    // Then start Whisper audio capture (may await mic permission)
    await whisper.startRecording();
  }, [whisper, startSpeechPreview]);

  const stopWhisper = useCallback(async (): Promise<string> => {
    setIsListening(false);
    setIsProcessing(true);

    // Stop Speech API preview — get its text as fallback
    const speechText = stopSpeechPreview();

    // Stop Whisper and get transcription
    const whisperText = await whisper.stopRecording();

    setIsProcessing(false);
    activeBackendRef.current = null;

    // Use Whisper result if available, fall back to Speech API text
    return whisperText || speechText;
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
    if (activeWhisper) {
      startWhisper();
      return;
    }
    // Auto-load Whisper model on first mic click
    if (canUseWhisper && !whisper.state.isModelLoaded && !whisper.state.isModelLoading) {
      whisper.loadModel();
    }
    // Use Speech API only while Whisper loads
    if (hasSpeechApi) {
      startSpeechOnly();
    }
  }, [activeWhisper, canUseWhisper, hasSpeechApi, whisper, startWhisper, startSpeechOnly]);

  const stop = useCallback(async (): Promise<string> => {
    const backend = activeBackendRef.current;
    if (backend === "whisper") {
      return stopWhisper();
    }
    return stopSpeechOnly();
  }, [stopWhisper, stopSpeechOnly]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      whisper.cancelRecording();
    };
  }, [whisper]);

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
