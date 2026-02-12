# Store Contract

## Overview

`web/src/store.ts` is a shared resource. Multiple domains need to add state slices and actions. This contract defines what each domain may add.

## Existing Interface (do not modify)

All existing slices and actions in `AppState` interface are frozen. No domain may rename, remove, or change the type of existing fields.

## Domain Additions

### input-enhancements domain

May add to `AppState`:

```typescript
// Prompt history per session (most recent last)
promptHistory: Map<string, string[]>;

// Actions
addPromptToHistory: (sessionId: string, prompt: string) => void;
```

Persistence: `promptHistory` should be persisted to localStorage under key `cc-prompt-history`.
Max entries: 50 per session (oldest dropped when exceeded).

### session-config domain

No store changes required. Permission modes are already supported by the existing `permissionMode` field on `SessionState`. Project detection results are transient UI state in HomePage component.

### notifications domain

No store changes required. Notification permission state is managed inside the `notifications.ts` utility module, not in Zustand.

## Rules

1. Each domain adds ONLY the slices listed above
2. New slices must use `Map<string, T>` pattern keyed by session ID (matching existing convention)
3. New actions must follow existing naming convention (verbNoun camelCase)
4. No domain may modify another domain's slices
5. All additions must maintain TypeScript strict mode compatibility
