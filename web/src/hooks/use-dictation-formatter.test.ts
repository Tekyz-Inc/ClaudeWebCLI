// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../api.js", () => ({
  api: {
    formatDictation: vi.fn(),
  },
}));

import { useDictationFormatter } from "./use-dictation-formatter.js";
import { api } from "../api.js";

const mockFormatDictation = api.formatDictation as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  mockFormatDictation.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDictationFormatter", () => {
  it("starts with empty state", () => {
    const { result } = renderHook(() => useDictationFormatter());
    expect(result.current.state).toEqual({
      ghostText: "",
      solidText: "",
      isFormatting: false,
    });
    expect(result.current.getDisplayText()).toBe("");
  });

  it("addRawText puts text into ghostText", () => {
    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world"));

    expect(result.current.state.ghostText).toBe("hello world");
    expect(result.current.state.solidText).toBe("");
    expect(result.current.getDisplayText()).toBe("hello world");
  });

  it("accumulates ghost text from multiple addRawText calls", () => {
    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello"));
    act(() => result.current.addRawText("world"));

    expect(result.current.state.ghostText).toBe("hello world");
    expect(result.current.getDisplayText()).toBe("hello world");
  });

  it("moves ghost to solid after successful format", async () => {
    mockFormatDictation.mockResolvedValue({
      formatted: "Hello world.",
      changed: true,
    });

    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world period"));

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFormatDictation).toHaveBeenCalledWith("hello world period");
    expect(result.current.state.solidText).toBe("Hello world.");
    expect(result.current.state.ghostText).toBe("");
    expect(result.current.state.isFormatting).toBe(false);
  });

  it("falls back to raw text when formatting fails", async () => {
    mockFormatDictation.mockRejectedValue(new Error("timeout"));

    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world"));

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should keep raw text even on failure
    expect(result.current.state.solidText).toBe("hello world");
    expect(result.current.state.ghostText).toBe("");
  });

  it("reset clears all state", () => {
    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello"));
    expect(result.current.state.ghostText).toBe("hello");

    act(() => result.current.reset());

    expect(result.current.state).toEqual({
      ghostText: "",
      solidText: "",
      isFormatting: false,
    });
  });

  it("ignores empty text", () => {
    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("  "));

    expect(result.current.state.ghostText).toBe("");
  });

  it("flush immediately formats ghost text and returns result", async () => {
    mockFormatDictation.mockResolvedValue({
      formatted: "Hello world.",
      changed: true,
    });

    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world period"));

    let flushed = "";
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(flushed).toBe("Hello world.");
    expect(result.current.state.solidText).toBe("Hello world.");
    expect(result.current.state.ghostText).toBe("");
  });

  it("flush returns solidText when no ghost text pending", async () => {
    mockFormatDictation.mockResolvedValue({
      formatted: "Hello.",
      changed: true,
    });

    const { result } = renderHook(() => useDictationFormatter());

    // Format some text first
    act(() => result.current.addRawText("hello period"));
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Flush with no pending ghost text
    let flushed = "";
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(flushed).toBe("Hello.");
  });

  it("flush preserves raw text on API failure", async () => {
    mockFormatDictation.mockRejectedValue(new Error("timeout"));

    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world"));

    let flushed = "";
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(flushed).toBe("hello world");
    expect(result.current.state.solidText).toBe("hello world");
    expect(result.current.state.ghostText).toBe("");
  });

  it("display text combines solid and ghost", async () => {
    mockFormatDictation.mockResolvedValue({
      formatted: "Hello.",
      changed: true,
    });

    const { result } = renderHook(() => useDictationFormatter());

    // First phrase: format it
    act(() => result.current.addRawText("hello period"));
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.solidText).toBe("Hello.");

    // Second phrase: still ghost
    act(() => result.current.addRawText("how are you"));

    expect(result.current.getDisplayText()).toBe("Hello. how are you");
  });
});
