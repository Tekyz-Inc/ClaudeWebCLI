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
  mockFormatDictation.mockReset();
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

  it("flush formats ghost text and returns result", async () => {
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

    expect(mockFormatDictation).toHaveBeenCalledWith("hello world period");
    expect(flushed).toBe("Hello world.");
    expect(result.current.state.ghostText).toBe("");
    expect(result.current.state.isFormatting).toBe(false);
  });

  it("flush returns raw text when formatting fails", async () => {
    mockFormatDictation.mockRejectedValue(new Error("timeout"));

    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world"));

    let flushed = "";
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(flushed).toBe("hello world");
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

  it("flush returns empty string when no ghost text", async () => {
    const { result } = renderHook(() => useDictationFormatter());

    let flushed = "";
    await act(async () => {
      flushed = await result.current.flush();
    });

    expect(flushed).toBe("");
    expect(mockFormatDictation).not.toHaveBeenCalled();
  });

  it("addRawText does not trigger formatting automatically", async () => {
    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello world"));

    // No formatting should happen without explicit flush
    expect(mockFormatDictation).not.toHaveBeenCalled();
    expect(result.current.state.ghostText).toBe("hello world");
    expect(result.current.state.solidText).toBe("");
  });

  it("getDisplayText shows ghost text during accumulation", () => {
    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello"));
    act(() => result.current.addRawText("how are you"));

    expect(result.current.getDisplayText()).toBe("hello how are you");
  });

  it("state clears after flush completes", async () => {
    mockFormatDictation.mockResolvedValue({
      formatted: "Hello.",
      changed: true,
    });

    const { result } = renderHook(() => useDictationFormatter());

    act(() => result.current.addRawText("hello period"));
    await act(async () => {
      await result.current.flush();
    });

    // After flush, all state should be clear
    expect(result.current.state.solidText).toBe("");
    expect(result.current.state.ghostText).toBe("");
    expect(result.current.state.isFormatting).toBe(false);
    expect(result.current.getDisplayText()).toBe("");
  });
});
