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

  /* ─── Whisper path ──────────────────────────────────── */

  const startWhisper = useCallback(async () => {
    setError(null);
    setInterimText("");
    setIsListening(true);
    activeBackendRef.current = "whisper";
    await whisper.startRecording();
  }, [whisper]);

  const stopWhisper = useCallback(async (): Promise<string> => {
    setIsListening(false);
    setIsProcessing(true);
    const text = await whisper.stopRecording();
    setIsProcessing(false);
    activeBackendRef.current = null;
    return text;
  }, [whisper]);

  /* ─── Web Speech API fallback ───────────────────────── */

  const startSpeechApi = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    setError(null);
    setInterimText("");
    accumulatedRef.current = "";
    activeBackendRef.current = "speech";

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
      setError(e.error);
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
      activeBackendRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
      activeBackendRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopSpeechApi = useCallback(async (): Promise<string> => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    activeBackendRef.current = null;
    const result = accumulatedRef.current;
    accumulatedRef.current = "";
    return result;
  }, []);

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
    // Use Web Speech API while Whisper loads
    if (hasSpeechApi) {
      startSpeechApi();
    }
  }, [activeWhisper, canUseWhisper, hasSpeechApi, whisper, startWhisper, startSpeechApi]);

  const stop = useCallback(async (): Promise<string> => {
    // Always use the same backend that was started — prevents race condition
    // where model loads between start/stop and we call the wrong stopper
    const backend = activeBackendRef.current;
    if (backend === "whisper") {
      return stopWhisper();
    }
    return stopSpeechApi();
  }, [stopWhisper, stopSpeechApi]);

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
