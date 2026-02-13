// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock use-whisper to avoid loading transformers.js in tests
vi.mock("./use-whisper.js", () => ({
  useWhisper: () => ({
    state: {
      isModelLoaded: false,
      isModelLoading: false,
      loadProgress: 0,
      isSupported: false,
      isTranscribing: false,
      error: null,
    },
    loadModel: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn().mockResolvedValue(""),
    cancelRecording: vi.fn(),
  }),
}));

import { useVoiceInput } from "./use-voice-input.js";

let mockInstances: MockSpeechRecognition[] = [];

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.onend?.();
  });
  abort = vi.fn();

  constructor() {
    mockInstances.push(this);
  }
}

beforeEach(() => {
  mockInstances = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVoiceInput", () => {
  it("reports unsupported when SpeechRecognition is absent and Whisper unavailable", () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it("reports supported when SpeechRecognition exists", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it("reports supported with webkit prefix", () => {
    vi.stubGlobal("webkitSpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it("start creates recognition instance and begins listening", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    expect(result.current.isListening).toBe(true);
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].start).toHaveBeenCalled();
    expect(mockInstances[0].continuous).toBe(true);
  });

  it("start does nothing when unsupported", () => {
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    expect(result.current.isListening).toBe(false);
    expect(mockInstances).toHaveLength(0);
  });

  it("stop returns accumulated transcript text", async () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    const instance = mockInstances[0];
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          item: () => null,
          0: {
            isFinal: true,
            length: 1,
            item: () => ({ transcript: "hello world", confidence: 0.9 }),
            0: { transcript: "hello world", confidence: 0.9 },
          },
        },
      });
    });

    let text = "";
    await act(async () => {
      text = await result.current.stop();
    });

    expect(text).toBe("hello world");
    expect(result.current.isListening).toBe(false);
  });

  it("sets interimText for non-final results", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    const instance = mockInstances[0];
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          item: () => null,
          0: {
            isFinal: false,
            length: 1,
            item: () => ({ transcript: "hello", confidence: 0.5 }),
            0: { transcript: "hello", confidence: 0.5 },
          },
        },
      });
    });

    expect(result.current.interimText).toBe("hello");
  });

  it("accumulates multiple final results", async () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    const instance = mockInstances[0];
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          item: () => null,
          0: {
            isFinal: true,
            length: 1,
            item: () => ({ transcript: "hello", confidence: 0.9 }),
            0: { transcript: "hello", confidence: 0.9 },
          },
        },
      });
    });
    act(() => {
      instance.onresult?.({
        resultIndex: 1,
        results: {
          length: 2,
          item: () => null,
          1: {
            isFinal: true,
            length: 1,
            item: () => ({ transcript: "world", confidence: 0.9 }),
            0: { transcript: "world", confidence: 0.9 },
          },
        },
      });
    });

    let text = "";
    await act(async () => {
      text = await result.current.stop();
    });

    expect(text).toBe("hello world");
  });

  it("sets error on recognition error", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    const instance = mockInstances[0];
    act(() => {
      instance.onerror?.({ error: "not-allowed" });
    });

    expect(result.current.error).toBe("not-allowed");
    expect(result.current.isListening).toBe(false);
  });

  it("resets isListening when recognition ends", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());
    expect(result.current.isListening).toBe(true);

    act(() => {
      mockInstances[0].onend?.();
    });

    expect(result.current.isListening).toBe(false);
  });

  it("exposes Whisper state properties", () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isModelLoaded).toBe(false);
    expect(result.current.isModelLoading).toBe(false);
    expect(result.current.loadProgress).toBe(0);
    expect(result.current.useWhisper).toBe(false);
    expect(result.current.isProcessing).toBe(false);
  });
});
