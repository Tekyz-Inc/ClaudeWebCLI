// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockAddPromptToHistory = vi.fn();
let mockHistory: Map<string, string[]> = new Map();

vi.mock("../store.js", () => {
  const useStore = {
    getState: () => ({
      promptHistory: mockHistory,
      addPromptToHistory: mockAddPromptToHistory,
    }),
  };
  return { useStore };
});

import { usePromptHistory } from "./use-prompt-history.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockHistory = new Map();
});

describe("usePromptHistory", () => {
  it("returns null when history is empty", () => {
    const { result } = renderHook(() => usePromptHistory("s1"));
    expect(result.current.navigateUp()).toBeNull();
    expect(result.current.navigateDown()).toBeNull();
  });

  it("navigateUp returns the most recent prompt", () => {
    mockHistory.set("s1", ["first", "second", "third"]);
    const { result } = renderHook(() => usePromptHistory("s1"));

    const value = result.current.navigateUp();
    expect(value).toBe("third");
  });

  it("navigateUp walks backward through history", () => {
    mockHistory.set("s1", ["a", "b", "c"]);
    const { result } = renderHook(() => usePromptHistory("s1"));

    expect(result.current.navigateUp()).toBe("c");
    expect(result.current.navigateUp()).toBe("b");
    expect(result.current.navigateUp()).toBe("a");
    // At oldest, stays there
    expect(result.current.navigateUp()).toBe("a");
  });

  it("navigateDown walks forward after navigateUp", () => {
    mockHistory.set("s1", ["a", "b", "c"]);
    const { result } = renderHook(() => usePromptHistory("s1"));

    result.current.navigateUp(); // c
    result.current.navigateUp(); // b
    expect(result.current.navigateDown()).toBe("c");
  });

  it("navigateDown past end restores draft", () => {
    mockHistory.set("s1", ["a", "b"]);
    const { result } = renderHook(() => usePromptHistory("s1"));

    result.current.saveDraft("my draft");
    result.current.navigateUp(); // b
    result.current.navigateUp(); // a
    result.current.navigateDown(); // b
    const restored = result.current.navigateDown(); // past end → draft
    expect(restored).toBe("my draft");
  });

  it("addToHistory calls store action and resets navigation", () => {
    const { result } = renderHook(() => usePromptHistory("s1"));
    result.current.addToHistory("new prompt");
    expect(mockAddPromptToHistory).toHaveBeenCalledWith("s1", "new prompt");
  });

  it("resetNavigation clears navigation state", () => {
    mockHistory.set("s1", ["a", "b"]);
    const { result } = renderHook(() => usePromptHistory("s1"));

    result.current.navigateUp(); // b
    result.current.resetNavigation();
    // After reset, navigateDown should return null (not navigating)
    expect(result.current.navigateDown()).toBeNull();
  });
});
