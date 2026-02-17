// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ─── Mock STTEngine from @tekyzinc/stt-component ──────── */

type EventHandler = (...args: unknown[]) => void;

const { MockSTTEngine, getMockInstances } = vi.hoisted(() => {
  const instances: InstanceType<typeof M>[] = [];

  class M {
    private listeners = new Map<string, EventHandler[]>();
    config: unknown;
    workerUrl: unknown;
    initCalled = false;
    startCalled = false;
    stopCalled = false;
    destroyCalled = false;

    constructor(config?: unknown, workerUrl?: unknown) {
      this.config = config;
      this.workerUrl = workerUrl;
      instances.push(this);
    }

    on(event: string, handler: EventHandler): M {
      const handlers = this.listeners.get(event) ?? [];
      handlers.push(handler);
      this.listeners.set(event, handlers);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      const handlers = this.listeners.get(event) ?? [];
      for (const h of handlers) h(...args);
    }

    async init(): Promise<void> {
      this.initCalled = true;
      this.emit("status", {
        status: "loading", isModelLoaded: false, loadProgress: 0,
        backend: null, error: null,
      });
      this.emit("status", {
        status: "ready", isModelLoaded: true, loadProgress: 100,
        backend: "webgpu", error: null,
      });
    }

    async start(): Promise<void> {
      this.startCalled = true;
      this.emit("status", {
        status: "recording", isModelLoaded: true, loadProgress: 100,
        backend: "webgpu", error: null,
      });
    }

    async stop(): Promise<string> {
      this.stopCalled = true;
      this.emit("status", {
        status: "processing", isModelLoaded: true, loadProgress: 100,
        backend: "webgpu", error: null,
      });
      this.emit("status", {
        status: "ready", isModelLoaded: true, loadProgress: 100,
        backend: "webgpu", error: null,
      });
      return "final transcription";
    }

    destroy(): void {
      this.destroyCalled = true;
      this.listeners.clear();
    }

    removeAllListeners(): void {
      this.listeners.clear();
    }
  }

  return {
    MockSTTEngine: M,
    getMockInstances: () => instances,
    clearInstances: () => { instances.length = 0; },
  };
});

vi.mock("@tekyzinc/stt-component", () => ({
  STTEngine: MockSTTEngine,
}));

import { useVoiceInput } from "./use-voice-input-component.js";

/* ─── Mock Speech API ──────────────────────────────────── */

let mockSpeechInstances: MockSpeechRecognition[] = [];

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => { this.onend?.(); });
  abort = vi.fn();

  constructor() {
    mockSpeechInstances.push(this);
  }
}

beforeEach(() => {
  getMockInstances().length = 0;
  mockSpeechInstances = [];
  vi.stubGlobal("Worker", class {});
  vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVoiceInput (component)", () => {
  it("reports supported when Worker exists", () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it("reports unsupported when no Worker and no SpeechRecognition", () => {
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("SpeechRecognition", undefined);
    const w = window as unknown as Record<string, unknown>;
    delete w.webkitSpeechRecognition;

    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(false);
  });

  it("creates STTEngine lazily on first start", async () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(getMockInstances().length).toBe(0);

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMockInstances().length).toBe(1);
    expect(getMockInstances()[0].initCalled).toBe(true);
  });

  it("sets isListening to true when start succeeds", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isListening).toBe(true);
  });

  it("starts Speech API preview for streaming text", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSpeechInstances.length).toBe(1);
    expect(mockSpeechInstances[0].continuous).toBe(true);
    expect(mockSpeechInstances[0].interimResults).toBe(true);
    expect(mockSpeechInstances[0].start).toHaveBeenCalled();
  });

  it("updates interimText from Speech API streaming results", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const recognition = mockSpeechInstances[0];
    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { 0: { transcript: "hello" }, isFinal: false, length: 1 },
        },
      });
    });

    expect(result.current.interimText).toBe("hello");
  });

  it("updates correctedText from engine correction event", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const engine = getMockInstances()[0];
    act(() => {
      engine.emit("correction", "Hello, world.");
    });

    expect(result.current.correctedText).toBe("Hello, world.");
    expect(result.current.interimText).toBe("Hello, world.");
  });

  it("ignores correction events after stop (prevents duplication)", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const engine = getMockInstances()[0];

    // Simulate correction during recording
    act(() => {
      engine.emit("correction", "hello");
    });
    expect(result.current.interimText).toBe("hello");

    // Stop recording — interimText persists until clearState() is called
    let finalText = "";
    await act(async () => {
      finalText = await result.current.stop();
    });

    expect(finalText).toBe("final transcription");
    // interimText/correctedText kept visible so display doesn't flash empty
    expect(result.current.interimText).toBe("hello");
    expect(result.current.correctedText).toBe("hello");
    expect(result.current.isListening).toBe(false);

    // Consumer calls clearState() after inserting text
    act(() => {
      result.current.clearState();
    });
    expect(result.current.interimText).toBe("");
    expect(result.current.correctedText).toBe("");
    expect(result.current.isProcessing).toBe(false);
  });

  it("stops Speech API preview on stop", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const recognition = mockSpeechInstances[0];

    await act(async () => {
      await result.current.stop();
    });

    expect(recognition.stop).toHaveBeenCalled();
  });

  it("clears state on new start", async () => {
    const { result } = renderHook(() => useVoiceInput());

    // First recording
    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const engine = getMockInstances()[0];
    act(() => {
      engine.emit("correction", "first recording");
    });

    await act(async () => {
      await result.current.stop();
    });

    // Second recording — state should be cleared
    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.interimText).toBe("");
    expect(result.current.correctedText).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("propagates engine errors", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const engine = getMockInstances()[0];
    act(() => {
      engine.emit("error", { code: "MIC_DENIED", message: "Mic access denied" });
    });

    expect(result.current.error).toBe("Mic access denied");
  });

  it("shows model loading state", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });

    // During init, engine emits loading status
    expect(result.current.isModelLoading).toBe(false);
    expect(result.current.isModelLoaded).toBe(true);
    expect(result.current.loadProgress).toBe(100);
  });

  it("destroys engine on unmount", async () => {
    const { result, unmount } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    const engine = getMockInstances()[0];
    unmount();
    expect(engine.destroyCalled).toBe(true);
  });

  it("returns empty string from stop when no engine", async () => {
    const { result } = renderHook(() => useVoiceInput());

    let text = "";
    await act(async () => {
      text = await result.current.stop();
    });

    expect(text).toBe("");
  });

  it("useWhisper returns true when model is loaded", async () => {
    const { result } = renderHook(() => useVoiceInput());

    expect(result.current.useWhisper).toBe(false);

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.useWhisper).toBe(true);
  });
});
