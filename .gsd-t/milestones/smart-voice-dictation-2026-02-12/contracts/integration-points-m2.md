# Integration Points — Milestone 2: Smart Voice Dictation

## Overview

Three domains with a linear dependency chain. No parallel execution possible — each domain depends on the previous.

## Domain Dependencies

| Domain | Server Changes | Client Changes | Dependencies |
|--------|---------------|----------------|-------------|
| server-formatter | routes.ts + new file | None | None |
| client-formatter | None | use-voice-input.ts, api.ts, new hook | server-formatter |
| ghost-ux | None | Composer.tsx, HomePage.tsx, index.css | client-formatter |

## Dependency Graph

```
server-formatter → client-formatter → ghost-ux
```

### server-formatter (can start immediately)
- Task 1: Create `dictation-formatter.ts`
- Task 2: Add endpoint to `routes.ts`

### client-formatter (BLOCKED BY server-formatter)
- Task 1: Strip regex from `use-voice-input.ts`
- Task 2: Add `formatDictation()` to `api.ts`
- Task 3: Create `use-dictation-formatter.ts` hook

### ghost-ux (BLOCKED BY client-formatter)
- Task 1: Wire formatter hook into Composer.tsx
- Task 2: Wire formatter hook into HomePage.tsx
- Task 3: Add ghost→solid CSS transition

## Integration Points

### 1. API Endpoint → Client Wrapper (server-formatter → client-formatter)

- **What:** `POST /api/format-dictation` endpoint consumed by `api.formatDictation()`
- **Contract:** api-contract.md defines request/response shape
- **Checkpoint:** server-formatter Task 2 must complete before client-formatter Task 2

### 2. Formatter Hook → UI Components (client-formatter → ghost-ux)

- **What:** `useDictationFormatter` hook consumed by Composer.tsx and HomePage.tsx
- **Contract:** component-contract.md defines hook interface (`FormatterState`, `addRawText`, etc.)
- **Checkpoint:** client-formatter Task 3 must complete before ghost-ux Task 1

### 3. Voice Hook → Formatter Hook (client-formatter internal)

- **What:** `useVoiceInput` simplified to raw text → feeds into `useDictationFormatter.addRawText()`
- **Contract:** component-contract.md defines updated `useVoiceInput` return type
- **Risk:** Low — voice hook simplification (removing code, not adding)

## Execution Order (solo sequential)

```
1. server-formatter Task 1: dictation-formatter.ts (new file)
2. server-formatter Task 2: routes.ts endpoint (add endpoint)
   → VERIFY: typecheck clean, server tests pass
3. client-formatter Task 1: strip regex from use-voice-input.ts
4. client-formatter Task 2: add formatDictation() to api.ts
5. client-formatter Task 3: create use-dictation-formatter.ts
   → VERIFY: typecheck clean, hook tests pass
6. ghost-ux Task 1: wire into Composer.tsx
7. ghost-ux Task 2: wire into HomePage.tsx
8. ghost-ux Task 3: add CSS transition
   → VERIFY: typecheck clean, full test suite pass
```

## Post-Integration Verification

After all domains complete:
1. Run full test suite — verify 560+ tests pass (plus new tests)
2. Run typecheck — verify clean
3. Manual smoke test:
   - Dictate "The last school period is 8:00" → "period" preserved
   - Dictate "Once school ends I'll head home period" → "period" becomes "."
   - Verify ghost text appears lighter, solidifies when formatted
   - Verify formatting uses subscription (no API key needed)
   - Verify graceful degradation when server is slow/unavailable
