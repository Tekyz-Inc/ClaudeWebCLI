import { useState, useRef, useCallback } from "react";
import { api } from "../api.js";

export interface FormatterState {
  ghostText: string;
  solidText: string;
  isFormatting: boolean;
}

const DEBOUNCE_MS = 300;

export function useDictationFormatter() {
  const [state, setState] = useState<FormatterState>({
    ghostText: "",
    solidText: "",
    isFormatting: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const flushFormat = useCallback(async (textToFormat: string, reqId: number) => {
    setState((s) => ({ ...s, isFormatting: true }));
    try {
      const result = await api.formatDictation(textToFormat);
      // Ignore if a newer request has been made
      if (reqId !== requestIdRef.current) return;
      setState((s) => ({
        solidText: s.solidText
          ? s.solidText + " " + result.formatted
          : result.formatted,
        ghostText: "",
        isFormatting: false,
      }));
    } catch {
      // On failure, move ghost text to solid unformatted (never lose input)
      if (reqId !== requestIdRef.current) return;
      setState((s) => ({
        solidText: s.solidText
          ? s.solidText + " " + textToFormat
          : textToFormat,
        ghostText: "",
        isFormatting: false,
      }));
    }
  }, []);

  const addRawText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setState((s) => ({
      ...s,
      ghostText: s.ghostText ? s.ghostText + " " + trimmed : trimmed,
    }));

    // Cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Increment request ID to invalidate in-flight requests
    const reqId = ++requestIdRef.current;

    debounceRef.current = setTimeout(() => {
      // Capture the current ghost text at debounce time
      setState((s) => {
        if (s.ghostText.trim()) {
          flushFormat(s.ghostText.trim(), reqId);
        }
        return s;
      });
    }, DEBOUNCE_MS);
  }, [flushFormat]);

  const getDisplayText = useCallback((): string => {
    const parts = [state.solidText, state.ghostText].filter(Boolean);
    return parts.join(" ");
  }, [state.solidText, state.ghostText]);

  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current++;
    setState({ ghostText: "", solidText: "", isFormatting: false });
  }, []);

  return { state, addRawText, getDisplayText, reset };
}
