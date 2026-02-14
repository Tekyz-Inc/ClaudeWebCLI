import { useState, useRef, useCallback } from "react";
import type { RawCapture } from "../utils/audio-utils.js";
import {
  startRawCapture,
  stopRawCapture,
  snapshotAudio,
  resampleAudio,
} from "../utils/audio-utils.js";

export interface WhisperState {
  isModelLoaded: boolean;
  isModelLoading: boolean;
  loadProgress: number;
  isSupported: boolean;
  isTranscribing: boolean;
  error: string | null;
}

function checkSupport(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

export function useWhisper() {
  const [state, setState] = useState<WhisperState>({
    isModelLoaded: false,
    isModelLoading: false,
    loadProgress: 0,
    isSupported: checkSupport(),
    isTranscribing: false,
    error: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const captureRef = useRef<RawCapture | null>(null);
  const transcribeResolveRef = useRef<((text: string) => void) | null>(null);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../utils/whisper-worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current.onmessage = (e) => {
        const { type, data } = e.data;
        switch (type) {
          case "progress":
            setState((s) => ({ ...s, loadProgress: data as number }));
            break;
          case "ready":
            setState((s) => ({
              ...s,
              isModelLoaded: true,
              isModelLoading: false,
              loadProgress: 100,
            }));
            break;
          case "result":
            setState((s) => ({ ...s, isTranscribing: false }));
            transcribeResolveRef.current?.(data as string);
            transcribeResolveRef.current = null;
            break;
          case "error":
            setState((s) => ({
              ...s,
              isModelLoading: false,
              isTranscribing: false,
              error: data as string,
            }));
            transcribeResolveRef.current?.("");
            transcribeResolveRef.current = null;
            break;
        }
      };
    }
    return workerRef.current;
  }, []);

  const loadModel = useCallback(async (): Promise<void> => {
    setState((s) => ({
      ...s,
      isModelLoading: true,
      loadProgress: 0,
      error: null,
    }));
    getWorker().postMessage({ type: "load" });
  }, [getWorker]);

  const startRecording = useCallback(async () => {
    try {
      setState((s) => ({ ...s, error: null }));
      const capture = await startRawCapture();
      captureRef.current = capture;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    if (!captureRef.current) return "";

    setState((s) => ({ ...s, isTranscribing: true }));

    const audio = await stopRawCapture(captureRef.current);
    captureRef.current = null;

    if (audio.length === 0) {
      setState((s) => ({ ...s, isTranscribing: false }));
      return "";
    }

    return new Promise<string>((resolve) => {
      transcribeResolveRef.current = resolve;
      getWorker().postMessage({ type: "transcribe", audio }, [audio.buffer]);
    });
  }, [getWorker]);

  const cancelRecording = useCallback(() => {
    if (captureRef.current) {
      for (const track of captureRef.current.stream.getTracks()) {
        track.stop();
      }
      captureRef.current.audioCtx.close().catch(() => {});
      captureRef.current = null;
    }
  }, []);

  const transcribeSnapshot = useCallback(async (): Promise<string> => {
    if (!captureRef.current) return "";

    const samples = snapshotAudio(captureRef.current);
    const nativeSr = captureRef.current.audioCtx.sampleRate;
    const audio = await resampleAudio(samples, nativeSr);
    if (audio.length === 0) return "";

    return new Promise<string>((resolve) => {
      transcribeResolveRef.current = resolve;
      getWorker().postMessage({ type: "transcribe", audio }, [audio.buffer]);
    });
  }, [getWorker]);

  const cancelTranscription = useCallback(() => {
    getWorker().postMessage({ type: "cancel" });
    if (transcribeResolveRef.current) {
      transcribeResolveRef.current("");
      transcribeResolveRef.current = null;
    }
  }, [getWorker]);

  return {
    state,
    loadModel,
    startRecording,
    stopRecording,
    cancelRecording,
    transcribeSnapshot,
    cancelTranscription,
  };
}
