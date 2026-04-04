import { resolve, normalize } from "node:path";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";

/**
 * Blocked system directory prefixes (platform-aware).
 * These protect against reading sensitive system files regardless of home/cwd.
 */
const BLOCKED_PREFIXES_UNIX = [
  "/etc/",
  "/etc",
  "/usr/",
  "/bin/",
  "/sbin/",
  "/sys/",
  "/proc/",
  "/dev/",
  "/boot/",
  "/lib/",
  "/lib64/",
];

const BLOCKED_PREFIXES_WIN = [
  "C:\\Windows\\",
  "C:\\Windows",
  "C:\\System32\\",
  "C:\\Program Files\\",
  "C:\\Program Files (x86)\\",
];

/** Shell metacharacters that must not appear in binary paths. */
const SHELL_METACHARACTERS = /[;|&$`(){}<>!]/;

/**
 * Resolve and validate that a requested path stays within an allowed base directory.
 *
 * Strategy:
 * - Resolve the path (handles ..)
 * - Attempt realpath to resolve symlinks; fall back to resolve-only if path doesn't exist yet
 * - Check resolved path starts with an allowed base (home dir or session cwd)
 * - Reject null bytes, blocked system prefixes
 *
 * Returns the resolved path if valid, throws PathTraversalError if not.
 */
export function validatePath(requestedPath: string, allowedBase: string): string {
  // Reject null bytes immediately
  if (requestedPath.includes("\0")) {
    throw new PathTraversalError("Null byte in path");
  }

  const resolved = resolve(requestedPath);

  // Attempt to resolve symlinks for existing paths
  let real = resolved;
  try {
    real = realpathSync.native(resolved);
  } catch {
    // Path doesn't exist yet (e.g., write to new file) — use resolve result
    real = resolved;
  }

  // Normalize the allowed base for comparison
  const base = normalize(resolve(allowedBase));
  const home = normalize(homedir());

  // Allow paths within session cwd OR home directory
  const withinBase = real === base || real.startsWith(base + "/") || real.startsWith(base + "\\");
  const withinHome = real === home || real.startsWith(home + "/") || real.startsWith(home + "\\");

  if (!withinBase && !withinHome) {
    throw new PathTraversalError(`Path escapes allowed boundaries: ${real}`);
  }

  // Reject blocked system directory prefixes
  const blockedPrefixes = process.platform === "win32" ? BLOCKED_PREFIXES_WIN : BLOCKED_PREFIXES_UNIX;
  for (const prefix of blockedPrefixes) {
    if (real === prefix.replace(/[\\/]$/, "") || real.startsWith(prefix)) {
      throw new PathTraversalError(`Access to system directory denied: ${real}`);
    }
  }

  return real;
}

/**
 * Error thrown when a path traversal attempt is detected.
 */
export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}

/** Dangerous environment variable keys that must be removed before CLI spawn. */
const DANGEROUS_ENV_KEYS = new Set([
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "NODE_OPTIONS",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "PERL5OPT",
  "RUBYOPT",
  "JAVA_TOOL_OPTIONS",
]);

/**
 * Remove dangerous environment variable keys from an env record.
 * Removes any key matching the denylist or starting with LD_ or DYLD_.
 */
export function filterEnvVars(vars: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (DANGEROUS_ENV_KEYS.has(key)) continue;
    if (key.startsWith("LD_") || key.startsWith("DYLD_")) continue;
    filtered[key] = value;
  }
  return filtered;
}

/**
 * Validate that a binary path refers to the "claude" CLI and nothing else.
 *
 * Accepts:
 * - "claude" (bare name)
 * - Paths ending in /claude or \claude (e.g., /usr/local/bin/claude)
 * - On Windows: paths ending in \claude.cmd or \claude.exe
 *
 * Rejects:
 * - Any binary name containing shell metacharacters
 * - Anything not named claude
 */
export function validateBinary(binary: string): boolean {
  if (!binary || typeof binary !== "string") return false;

  // Reject shell metacharacters
  if (SHELL_METACHARACTERS.test(binary)) return false;

  // Reject null bytes
  if (binary.includes("\0")) return false;

  // Normalize separators for comparison
  const normalized = binary.replace(/\\/g, "/");

  // Bare name: must be exactly "claude"
  if (!normalized.includes("/")) {
    return normalized === "claude";
  }

  // Path: basename must be claude, claude.cmd, or claude.exe
  const base = normalized.split("/").pop() ?? "";
  return base === "claude" || base === "claude.cmd" || base === "claude.exe";
}
