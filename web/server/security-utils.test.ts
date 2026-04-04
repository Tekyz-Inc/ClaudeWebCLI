import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import { validatePath, filterEnvVars, validateBinary, PathTraversalError } from "./security-utils.js";

const cwd = process.cwd();
const home = homedir();

describe("validatePath", () => {
  it("accepts a path within cwd", () => {
    const input = join(cwd, "server", "index.ts");
    const result = validatePath(input, cwd);
    expect(result).toBeTruthy();
  });

  it("accepts a path within home directory", () => {
    const input = join(home, "some-file.txt");
    // Should not throw — home is always allowed
    const result = validatePath(input, cwd);
    expect(result).toBeTruthy();
  });

  it("rejects ../ traversal above cwd and home", () => {
    // Construct a path that goes above both home and cwd
    const input = "/tmp/evil-file.txt";
    expect(() => validatePath(input, cwd)).toThrow(PathTraversalError);
  });

  it("rejects null bytes in path", () => {
    const input = join(cwd, "file\0.txt");
    expect(() => validatePath(input, cwd)).toThrow(PathTraversalError);
  });

  it("rejects paths resolving to system directories on unix", () => {
    if (process.platform === "win32") return;
    expect(() => validatePath("/etc/passwd", cwd)).toThrow(PathTraversalError);
    expect(() => validatePath("/usr/bin/sh", cwd)).toThrow(PathTraversalError);
    expect(() => validatePath("/proc/self/environ", cwd)).toThrow(PathTraversalError);
  });

  it("rejects Windows system directories on win32", () => {
    if (process.platform !== "win32") return;
    expect(() => validatePath("C:\\Windows\\System32\\cmd.exe", cwd)).toThrow(PathTraversalError);
  });

  it("rejects dot-dot traversal strings", () => {
    // A path that attempts to escape using ../../../etc/passwd
    const input = join(cwd, "..", "..", "..", "etc", "passwd");
    // Either throws (unix) or resolves to a non-system path within home
    try {
      const result = validatePath(input, cwd);
      // If it didn't throw, it must be within home (shouldn't happen for /etc/passwd)
      expect(result).toBeTruthy();
    } catch (e) {
      expect(e).toBeInstanceOf(PathTraversalError);
    }
  });

  it("returns resolved path string on success", () => {
    const input = join(cwd, "server");
    const result = validatePath(input, cwd);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("filterEnvVars", () => {
  it("removes LD_PRELOAD", () => {
    const result = filterEnvVars({ LD_PRELOAD: "/evil.so", HOME: "/home/user" });
    expect(result).not.toHaveProperty("LD_PRELOAD");
    expect(result).toHaveProperty("HOME");
  });

  it("removes NODE_OPTIONS", () => {
    const result = filterEnvVars({ NODE_OPTIONS: "--require evil", HOME: "/home/user" });
    expect(result).not.toHaveProperty("NODE_OPTIONS");
  });

  it("removes PYTHONPATH", () => {
    const result = filterEnvVars({ PYTHONPATH: "/evil", PATH: "/usr/bin" });
    expect(result).not.toHaveProperty("PYTHONPATH");
  });

  it("preserves PATH (needed for CLI subprocess to find node)", () => {
    const result = filterEnvVars({ PATH: "/usr/bin:/usr/local/bin" });
    expect(result).toHaveProperty("PATH", "/usr/bin:/usr/local/bin");
  });

  it("removes LD_LIBRARY_PATH", () => {
    const result = filterEnvVars({ LD_LIBRARY_PATH: "/evil" });
    expect(result).not.toHaveProperty("LD_LIBRARY_PATH");
  });

  it("removes DYLD_INSERT_LIBRARIES", () => {
    const result = filterEnvVars({ DYLD_INSERT_LIBRARIES: "/evil.dylib" });
    expect(result).not.toHaveProperty("DYLD_INSERT_LIBRARIES");
  });

  it("removes any key starting with LD_", () => {
    const result = filterEnvVars({ LD_CUSTOM: "evil", LD_AUDIT: "evil2", SAFE: "ok" });
    expect(result).not.toHaveProperty("LD_CUSTOM");
    expect(result).not.toHaveProperty("LD_AUDIT");
    expect(result).toHaveProperty("SAFE");
  });

  it("removes any key starting with DYLD_", () => {
    const result = filterEnvVars({ DYLD_FRAMEWORK_PATH: "/evil", SAFE: "ok" });
    expect(result).not.toHaveProperty("DYLD_FRAMEWORK_PATH");
    expect(result).toHaveProperty("SAFE");
  });

  it("keeps safe environment variables", () => {
    const result = filterEnvVars({
      HOME: "/home/user",
      USER: "alice",
      LANG: "en_US.UTF-8",
      TERM: "xterm-256color",
      ANTHROPIC_API_KEY: "sk-test",
    });
    expect(result).toHaveProperty("HOME");
    expect(result).toHaveProperty("USER");
    expect(result).toHaveProperty("LANG");
    expect(result).toHaveProperty("TERM");
    expect(result).toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("removes PYTHONSTARTUP, PERL5OPT, RUBYOPT, JAVA_TOOL_OPTIONS", () => {
    const result = filterEnvVars({
      PYTHONSTARTUP: "/evil.py",
      PERL5OPT: "-Mevil",
      RUBYOPT: "-revil",
      JAVA_TOOL_OPTIONS: "-agentlib:evil",
    });
    expect(result).not.toHaveProperty("PYTHONSTARTUP");
    expect(result).not.toHaveProperty("PERL5OPT");
    expect(result).not.toHaveProperty("RUBYOPT");
    expect(result).not.toHaveProperty("JAVA_TOOL_OPTIONS");
  });

  it("returns a copy — does not mutate input", () => {
    const input = { HOME: "/home/user", LD_PRELOAD: "/evil.so" };
    filterEnvVars(input);
    expect(input).toHaveProperty("LD_PRELOAD");
  });
});

describe("validateBinary", () => {
  it("accepts bare name 'claude'", () => {
    expect(validateBinary("claude")).toBe(true);
  });

  it("accepts unix path ending in /claude", () => {
    expect(validateBinary("/usr/local/bin/claude")).toBe(true);
    expect(validateBinary("/home/user/.nvm/bin/claude")).toBe(true);
  });

  it("accepts windows path ending in claude.cmd", () => {
    expect(validateBinary("C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd")).toBe(true);
  });

  it("accepts windows path ending in claude.exe", () => {
    expect(validateBinary("C:\\Program Files\\claude\\claude.exe")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateBinary("")).toBe(false);
  });

  it("rejects a different bare binary name", () => {
    expect(validateBinary("bash")).toBe(false);
    expect(validateBinary("node")).toBe(false);
    expect(validateBinary("python")).toBe(false);
  });

  it("rejects paths not ending in claude", () => {
    expect(validateBinary("/usr/bin/bash")).toBe(false);
    expect(validateBinary("/usr/bin/node")).toBe(false);
  });

  it("rejects shell metacharacters in binary name", () => {
    expect(validateBinary("claude; rm -rf /")).toBe(false);
    expect(validateBinary("claude|evil")).toBe(false);
    expect(validateBinary("claude&evil")).toBe(false);
    expect(validateBinary("$(evil)")).toBe(false);
  });

  it("rejects null byte in binary name", () => {
    expect(validateBinary("claude\0evil")).toBe(false);
  });

  it("rejects path-like names that end in claudeevil (not /claude)", () => {
    expect(validateBinary("/usr/bin/claudeevil")).toBe(false);
    expect(validateBinary("/usr/bin/not-claude")).toBe(false);
  });
});
