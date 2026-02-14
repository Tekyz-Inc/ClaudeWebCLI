// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock use-whisper to avoid loading transformers.js in tests
const mockWhisper = {
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
  transcribeSnapshot: vi.fn().mockResolvedValue(""),
  cancelTranscription: vi.fn(),
};

vi.mock("./use-whisper.js", () => ({
  useWhisper: () => mockWhisper,
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

describe("useVoiceInput — mid-recording correction", () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  let fakeNow: number;

  beforeEach(() => {
    fakeNow = 1000;
    dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
    mockWhisper.state.isSupported = true;
    mockWhisper.state.isModelLoaded = true;
    mockWhisper.state.isModelLoading = false;
    mockWhisper.transcribeSnapshot.mockResolvedValue("Corrected text.");
    mockWhisper.cancelTranscription.mockClear();
    mockWhisper.transcribeSnapshot.mockClear();
    mockWhisper.startRecording.mockClear();
    mockWhisper.stopRecording.mockResolvedValue("Final corrected.");
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    mockWhisper.state.isSupported = false;
    mockWhisper.state.isModelLoaded = false;
  });

  it("triggers correction on Speech API pause after >= 5s", async () => {
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    // Advance fake time past the 5s threshold
    fakeNow += 5001;

    // Simulate Speech API onend (pause)
    const instance = mockInstances[0];
    await act(async () => {
      instance.onend?.();
      // Allow the async transcribeSnapshot promise to resolve
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockWhisper.cancelTranscription).toHaveBeenCalled();
    expect(mockWhisper.transcribeSnapshot).toHaveBeenCalled();
    expect(result.current.interimText).toBe("Corrected text.");
    expect(result.current.correctedText).toBe("Corrected text.");
  });

  it("does NOT trigger correction before 5s threshold", async () => {
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    // Only 2s elapsed — below threshold
    fakeNow += 2000;

    const instance = mockInstances[0];
    await act(async () => {
      instance.onend?.();
      await Promise.resolve();
    });

    expect(mockWhisper.transcribeSnapshot).not.toHaveBeenCalled();
  });

  it("cancels previous transcription before new correction", async () => {
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    // First correction
    fakeNow += 5001;
    const instance = mockInstances[0];
    await act(async () => {
      instance.onend?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockWhisper.cancelTranscription).toHaveBeenCalledTimes(1);

    // Second correction after another 5s
    fakeNow += 5001;
    await act(async () => {
      instance.onend?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockWhisper.cancelTranscription).toHaveBeenCalledTimes(2);
    expect(mockWhisper.transcribeSnapshot).toHaveBeenCalledTimes(2);
  });

  it("does not correct when model not loaded", async () => {
    mockWhisper.state.isModelLoaded = false;
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    fakeNow += 5001;
    const instance = mockInstances[0];
    await act(async () => {
      instance.onend?.();
      await Promise.resolve();
    });

    expect(mockWhisper.transcribeSnapshot).not.toHaveBeenCalled();
  });

  it("correctedText resets to empty on new recording start", async () => {
    const { result } = renderHook(() => useVoiceInput());

    // First recording + correction
    act(() => result.current.start());
    fakeNow += 5001;
    const instance = mockInstances[0];
    await act(async () => {
      instance.onend?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.correctedText).toBe("Corrected text.");

    // Stop and start again
    await act(async () => { await result.current.stop(); });
    act(() => result.current.start());
    expect(result.current.correctedText).toBe("");
  });

  it("stop cancels any in-flight correction", async () => {
    const { result } = renderHook(() => useVoiceInput());

    act(() => result.current.start());

    await act(async () => {
      await result.current.stop();
    });

    expect(mockWhisper.cancelTranscription).toHaveBeenCalled();
  });
});
