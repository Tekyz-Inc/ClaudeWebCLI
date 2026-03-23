import { useRef, useEffect } from "react";

// Module-level cache: persists drafts across project tab switches
const _sessionDrafts = new Map<string, string>();
const DRAFT_PREFIX = "cc-draft:";

export function getDraft(key: string): string {
  return _sessionDrafts.get(key) ?? sessionStorage.getItem(DRAFT_PREFIX + key) ?? "";
}

export function setDraft(key: string, value: string): void {
  _sessionDrafts.set(key, value);
  if (value) {
    sessionStorage.setItem(DRAFT_PREFIX + key, value);
  } else {
    sessionStorage.removeItem(DRAFT_PREFIX + key);
  }
}

/**
 * Persists and restores draft text when the draftKey (project path or session ID) changes.
 * Returns the draft key ref so callers can access the current key in callbacks.
 */
export function useDraftPersistence(
  draftKey: string,
  text: string,
  setText: (t: string) => void,
) {
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);

  const draftKeyRef = useRef(draftKey);
  useEffect(() => { draftKeyRef.current = draftKey; });

  // Save outgoing draft, restore incoming draft on project/session switch
  useEffect(() => {
    setText(getDraft(draftKey));
    return () => {
      setDraft(draftKeyRef.current, textRef.current);
    };
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { draftKeyRef };
}
