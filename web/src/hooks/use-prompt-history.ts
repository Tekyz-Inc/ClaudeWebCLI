import { useRef, useCallback } from "react";
import { useStore } from "../store.js";

/**
 * Hook for navigating prompt history (Up/Down arrows like a terminal).
 * Returns navigation functions and a method to add prompts to history.
 * Caller must call saveDraft(text) before navigateUp() to preserve draft.
 */
export function usePromptHistory(sessionId: string) {
  const indexRef = useRef<number>(-1);
  const draftRef = useRef<string>("");

  const navigateUp = useCallback((): string | null => {
    const history = useStore.getState().promptHistory.get(sessionId) || [];
    if (history.length === 0) return null;

    if (indexRef.current === -1) {
      indexRef.current = history.length - 1;
    } else if (indexRef.current > 0) {
      indexRef.current--;
    } else {
      return history[0]; // Already at oldest
    }

    return history[indexRef.current];
  }, [sessionId]);

  const navigateDown = useCallback((): string | null => {
    const history = useStore.getState().promptHistory.get(sessionId) || [];
    if (indexRef.current === -1) return null; // Not navigating

    if (indexRef.current < history.length - 1) {
      indexRef.current++;
      return history[indexRef.current];
    }

    // Past the end — restore draft
    indexRef.current = -1;
    return draftRef.current;
  }, [sessionId]);

  const addToHistory = useCallback((prompt: string) => {
    useStore.getState().addPromptToHistory(sessionId, prompt);
    indexRef.current = -1;
    draftRef.current = "";
  }, [sessionId]);

  const resetNavigation = useCallback(() => {
    indexRef.current = -1;
    draftRef.current = "";
  }, []);

  /** Save the current text as a draft before navigating */
  const saveDraft = useCallback((text: string) => {
    if (indexRef.current === -1) {
      draftRef.current = text;
    }
  }, []);

  return { navigateUp, navigateDown, addToHistory, resetNavigation, saveDraft };
}
