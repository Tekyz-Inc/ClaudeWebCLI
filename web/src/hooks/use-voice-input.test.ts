// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ─── Mock STTEngine ──────────────────────────────────── */

type EventHandler = (...args: unknown[]) => void;

class MockSTTEngine {
  private handlers: Record<string, EventHandler[]> = {};
  initCalled = false;
  startCalled = false;
  stopCalled = false;
  destroyCalled = false;
  stopResult = "Final transcription.";

  on(event: string, handler: EventHandler): void {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    for (const h of this.handlers[event] ?? []) h(...args);
  }

  async init(): Promise<void> {
    this.initCalled = true;
  }

  async start(): Promise<void> {
    this.startCalled = true;
  }

  async stop(): Promise<string> {
    this.stopCalled = true;
    return this.stopResult;
  }

  destroy(): void {
    this.destroyCalled = true;
  }

  getState(): { status: string } {
    return { status: this.initCalled ? "ready" : "idle" };
  }
}

let mockEngine: MockSTTEngine;

vi.mock("@tekyzinc/stt-component", () => ({
  STTEngine: class {
    constructor() {
      return mockEngine;
    }
  },
}));

import { useVoiceInput } from "./use-voice-input.js";

/* ─── Setup ───────────────────────────────────────────── */

beforeEach(() => {
  mockEngine = new MockSTTEngine();
});

/* ─── Tests ───────────────────────────────────────────── */

describe("useVoiceInput", () => {
  it("reports supported when Worker is available", () => {
    vi.stubGlobal("Worker", class {});
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
    vi.unstubAllGlobals();
  });

  it("initial state is idle", () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isListening).toBe(false);
    expect(result.current.isStarting).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.interimText).toBe("");
    expect(result.current.correctedText).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.isModelLoaded).toBe(false);
    expect(result.current.isModelLoading).toBe(false);
    expect(result.current.loadProgress).toBe(0);
    expect(result.current.useWhisper).toBe(false);
  });

  it("start() inits engine and begins listening", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockEngine.initCalled).toBe(true);
    expect(mockEngine.startCalled).toBe(true);
    expect(result.current.isListening).toBe(true);
  });

  it("isStarting is false after engine init completes", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isStarting).toBe(false);
    expect(result.current.isListening).toBe(true);
  });

  it("stop() returns engine transcription", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    let text = "";
    await act(async () => {
      text = await result.current.stop();
    });

    expect(text).toBe("Final transcription.");
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(true);
  });

  it("stop() returns empty string and destroys engine when hung past 2s timeout", async () => {
    vi.useFakeTimers();
    // Make stop() hang indefinitely
    mockEngine.stop = () => new Promise<string>(() => {});

    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    let text = "not-empty";
    await act(async () => {
      const stopPromise = result.current.stop();
      await vi.advanceTimersByTimeAsync(2001);
      text = await stopPromise;
    });

    expect(text).toBe("");
    expect(mockEngine.destroyCalled).toBe(true);
    vi.useRealTimers();
  });

  it("clearState() resets display state", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockEngine.emit("correction", "Some corrected text");
    });
    expect(result.current.correctedText).toBe("Some corrected text");

    await act(async () => {
      await result.current.stop();
    });

    act(() => {
      result.current.clearState();
    });

    expect(result.current.interimText).toBe("");
    expect(result.current.correctedText).toBe("");
    expect(result.current.isProcessing).toBe(false);
  });
});

describe("useVoiceInput — engine events", () => {
  it("transcript event updates interimText", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockEngine.emit("transcript", "hello world");
    });

    expect(result.current.interimText).toBe("hello world");
  });

  it("correction updates both correctedText and interimText", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockEngine.emit("correction", "  Hello world.  ");
    });

    expect(result.current.correctedText).toBe("Hello world.");
    expect(result.current.interimText).toBe("Hello world.");
  });

  it("error event updates error state", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockEngine.emit("error", {
        code: "MIC_DENIED",
        message: "Microphone access denied",
      });
    });

    expect(result.current.error).toBe("Microphone access denied");
  });

  it("status event updates model state", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockEngine.emit("status", {
        isModelLoaded: true,
        loadProgress: 100,
        status: "idle",
      });
    });

    expect(result.current.isModelLoaded).toBe(true);
    expect(result.current.loadProgress).toBe(100);
    expect(result.current.useWhisper).toBe(true);
  });

  it("ignores events after stop", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.stop();
    });

    act(() => {
      mockEngine.emit("correction", "late correction");
    });

    expect(result.current.correctedText).not.toBe("late correction");
  });

  it("correctedText resets on new recording start", async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockEngine.emit("correction", "First correction");
    });
    expect(result.current.correctedText).toBe("First correction");

    await act(async () => {
      await result.current.stop();
    });

    act(() => result.current.clearState());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.correctedText).toBe("");
    expect(result.current.interimText).toBe("");
  });
});

describe("useVoiceInput — cleanup", () => {
  it("destroys engine on unmount", async () => {
    const { result, unmount } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    unmount();

    expect(mockEngine.destroyCalled).toBe(true);
  });
});
