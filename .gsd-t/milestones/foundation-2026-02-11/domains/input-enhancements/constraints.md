# Constraints: input-enhancements

## Must Follow

- TypeScript strict mode on all new code
- Functions under 30 lines — extract hooks for complex logic
- Files under 200 lines — Composer.tsx is already 460 lines (over limit), do NOT increase significantly; extract hooks
- kebab-case file names, camelCase functions, PascalCase types
- Reuse existing `readFileAsBase64()` from Composer.tsx for file processing (do not duplicate)
- Use existing Tailwind theme tokens (`bg-cc-*`, `text-cc-*`) for all UI
- All new features must include tests
- Web Speech API must degrade gracefully — check `window.SpeechRecognition || window.webkitSpeechRecognition` before rendering voice button

## Must Not

- Modify files outside owned scope
- Add new npm dependencies (Web Speech API and File API are browser-native)
- Break existing slash command autocomplete, image paste, or plan mode toggle in Composer
- Store prompt history on the server — client-only (localStorage via Zustand persist)
- Remove or modify any existing tests

## Dependencies

- Depends on: none (all browser-native APIs)
- Depended on by: none
