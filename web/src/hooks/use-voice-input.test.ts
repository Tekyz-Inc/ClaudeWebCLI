// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
  it("reports unsupported when SpeechRecognition is absent", () => {
    const { result } = renderHook(() => useVoiceInput(vi.fn()));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it("reports supported when SpeechRecognition exists", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput(vi.fn()));
    expect(result.current.isSupported).toBe(true);
  });

  it("reports supported with webkit prefix", () => {
    vi.stubGlobal("webkitSpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput(vi.fn()));
    expect(result.current.isSupported).toBe(true);
  });

  it("start creates recognition instance and begins listening", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput(vi.fn()));

    act(() => result.current.start());

    expect(result.current.isListening).toBe(true);
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].start).toHaveBeenCalled();
    expect(mockInstances[0].continuous).toBe(true);
  });

  it("start does nothing when unsupported", () => {
    const { result } = renderHook(() => useVoiceInput(vi.fn()));

    act(() => result.current.start());

    expect(result.current.isListening).toBe(false);
    expect(mockInstances).toHaveLength(0);
  });

  it("stop calls recognition.stop and resets state", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput(vi.fn()));

    act(() => result.current.start());
    act(() => result.current.stop());

    expect(result.current.isListening).toBe(false);
    expect(mockInstances[0].stop).toHaveBeenCalled();
  });

  it("calls onTranscript with final transcript text", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript));

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

    expect(onTranscript).toHaveBeenCalledWith("hello world");
  });

  it("sets error on recognition error", () => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
    const { result } = renderHook(() => useVoiceInput(vi.fn()));

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
    const { result } = renderHook(() => useVoiceInput(vi.fn()));

    act(() => result.current.start());
    expect(result.current.isListening).toBe(true);

    act(() => {
      mockInstances[0].onend?.();
    });

    expect(result.current.isListening).toBe(false);
  });
});
