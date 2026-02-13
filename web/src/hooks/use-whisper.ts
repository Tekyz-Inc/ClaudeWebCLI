import { useState, useRef, useCallback } from "react";
import { startAudioCapture, stopAndConvert } from "../utils/audio-utils.js";

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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
      const { recorder, stream, chunks } = await startAudioCapture();
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = chunks;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    if (!recorderRef.current || !streamRef.current) return "";

    setState((s) => ({ ...s, isTranscribing: true }));

    const audio = await stopAndConvert(
      recorderRef.current,
      streamRef.current,
      chunksRef.current,
    );
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];

    return new Promise<string>((resolve) => {
      transcribeResolveRef.current = resolve;
      getWorker().postMessage({ type: "transcribe", audio }, [audio.buffer]);
    });
  }, [getWorker]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  return { state, loadModel, startRecording, stopRecording, cancelRecording };
}
