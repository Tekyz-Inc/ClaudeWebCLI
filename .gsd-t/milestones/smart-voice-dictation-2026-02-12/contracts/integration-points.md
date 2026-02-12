# Integration Points

## Overview

The three Foundation domains are largely independent. All features use browser-native APIs and modify different files. The primary shared resource is `store.ts`, governed by `store-contract.md`.

## Domain Independence

| Domain | Server Changes | Shared Files | Dependencies |
|--------|---------------|--------------|-------------|
| input-enhancements | None | store.ts (add slice) | None |
| session-config | None | None | None |
| notifications | None | ws.ts (add calls) | None |

## Dependency Graph

### Independent (can start immediately)
- input-enhancements: Tasks 1, 2, 3 (all independent)
- session-config: Task 1
- notifications: Tasks 1, 2 (all independent)

### Within-Domain Dependency
- session-config Task 2 BLOCKED BY session-config Task 1 (both modify HomePage.tsx)

### Cross-Domain Dependencies
- NONE — all three domains can execute fully in parallel

## Integration Points

### 1. Store Integration (input-enhancements → store.ts)

- **What:** input-enhancements Task 1 adds `promptHistory` slice to Zustand store
- **When:** During input-enhancements Task 1 execution
- **Contract:** store-contract.md defines exact additions
- **Risk:** Low — additive only, no existing state modified

### 2. Notification Triggers (notifications → ws.ts)

- **What:** notifications Task 1 adds `sendNotification()` calls in ws.ts message handlers
- **When:** During notifications Task 1 execution
- **Where in ws.ts:**
  - After line 227 (`store.setSessionStatus(sessionId, "idle")`) in `case "result"` → notify "Session complete"
  - After line 240 (`store.addPermission(sessionId, data.request)`) in `case "permission_request"` → notify "Permission needed"
- **Contract:** component-contract.md defines notification utility interface
- **Risk:** Low — adds 2-3 lines at well-defined insertion points

## Execution Order (for solo mode)

```
Phase 1 (all parallel-safe):
  ├── input-enhancements Task 1: Prompt history
  ├── input-enhancements Task 2: Voice dictation
  ├── input-enhancements Task 3: File drag-and-drop
  ├── session-config Task 1: Permission modes
  ├── notifications Task 1: Desktop notifications
  └── notifications Task 2: Context meter threshold

Phase 2 (after session-config Task 1):
  └── session-config Task 2: Project detection

VERIFY: typecheck + full test suite
```

Solo sequential recommended order (minimizes context switching per file):
1. notifications Task 2 (trivial 1-line change, warm up)
2. notifications Task 1 (notifications.ts + ws.ts)
3. session-config Task 1 (HomePage.tsx permission modes)
4. session-config Task 2 (HomePage.tsx project detection)
5. input-enhancements Task 1 (store.ts + hook + Composer.tsx)
6. input-enhancements Task 2 (hook + Composer.tsx)
7. input-enhancements Task 3 (Composer.tsx)

## Post-Domain Verification

After all domains complete:
1. Run full test suite — verify 517+ tests pass (plus new tests)
2. Run typecheck — verify clean
3. Manual smoke test: create a session, test voice input, test prompt history, test drag-drop, test notifications, verify context meter colors, verify all 4 permission modes
