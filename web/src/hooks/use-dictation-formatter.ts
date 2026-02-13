import { useState, useRef, useCallback } from "react";
import { api } from "../api.js";

export interface FormatterState {
  ghostText: string;
  solidText: string;
  isFormatting: boolean;
}

export function useDictationFormatter() {
  const [state, setState] = useState<FormatterState>({
    ghostText: "",
    solidText: "",
    isFormatting: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const addRawText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Accumulate raw text — formatting happens only on flush()
    setState((s) => ({
      ...s,
      ghostText: s.ghostText ? s.ghostText + " " + trimmed : trimmed,
    }));
  }, []);

  const getDisplayText = useCallback((): string => {
    const parts = [state.solidText, state.ghostText].filter(Boolean);
    return parts.join(" ");
  }, [state.solidText, state.ghostText]);

  /** Format all accumulated ghostText and return the result. */
  const flush = useCallback(async (): Promise<string> => {
    const ghost = stateRef.current.ghostText.trim();
    if (!ghost) return "";

    setState((s) => ({ ...s, isFormatting: true }));
    try {
      const result = await api.formatDictation(ghost);
      const formatted = result.formatted;
      setState({ solidText: "", ghostText: "", isFormatting: false });
      return formatted;
    } catch {
      // On failure, return raw text (never lose input)
      setState({ solidText: "", ghostText: "", isFormatting: false });
      return ghost;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ ghostText: "", solidText: "", isFormatting: false });
  }, []);

  return { state, addRawText, getDisplayText, flush, reset };
}
