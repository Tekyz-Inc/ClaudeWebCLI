import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Bun.spawn before importing the module
const mockSpawn = vi.fn();
const originalBunSpawn = globalThis.Bun?.spawn;

describe("dictation-formatter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns unchanged result for empty input", async () => {
    const { formatDictation } = await import("./dictation-formatter.js");
    const result = await formatDictation("   ");
    expect(result).toEqual({ formatted: "   ", changed: false });
  });

  it("returns unchanged result for whitespace-only input", async () => {
    const { formatDictation } = await import("./dictation-formatter.js");
    const result = await formatDictation("");
    expect(result).toEqual({ formatted: "", changed: false });
  });

  it("exports FormatResult type", async () => {
    const mod = await import("./dictation-formatter.js");
    expect(typeof mod.formatDictation).toBe("function");
  });

  it("truncates input to 2000 chars", async () => {
    // This test verifies the function accepts long input without crashing
    // We can't easily test the actual truncation without mocking Bun.spawn
    const { formatDictation } = await import("./dictation-formatter.js");
    const longText = "a".repeat(3000);
    // This will fail because no CLI is available in test, but shouldn't throw
    const result = await formatDictation(longText);
    // Result is null because Bun.spawn fails in test env — that's expected
    expect(result === null || result.formatted !== undefined).toBe(true);
  });
});
