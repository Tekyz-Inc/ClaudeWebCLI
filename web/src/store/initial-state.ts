/**
 * Helpers to derive initial store state from localStorage/sessionStorage.
 * Extracted from store.ts to reduce file size.
 */

export function getInitialSessionNames(): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    return new Map(JSON.parse(localStorage.getItem("cc-session-names") || "[]"));
  } catch {
    return new Map();
  }
}

export function getInitialSessionId(): string | null {
  if (typeof window === "undefined") return null;
  // sessionStorage is per-tab: new tabs start fresh, refresh restores the session
  return sessionStorage.getItem("cc-current-session") || null;
}

export function getInitialPromptHistory(): Map<string, string[]> {
  if (typeof window === "undefined") return new Map();
  try {
    return new Map(JSON.parse(localStorage.getItem("cc-prompt-history") || "[]"));
  } catch {
    return new Map();
  }
}

export function getInitialDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("cc-dark-mode");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getInitialHiddenProjects(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("cc-hidden-projects") || "[]"));
  } catch {
    return new Set<string>();
  }
}
