# Tasks: notifications

## Summary

Adds browser desktop notifications for session events when the tab is not focused, and adjusts the context meter color thresholds to match the milestone specification.

## Tasks

### Task 1: Desktop notifications utility and ws.ts integration

- **Files**:
  - `web/src/utils/notifications.ts` — NEW: implements `isNotificationSupported()`, `requestNotificationPermission()`, `sendNotification(title, options?)` per component-contract.md. The `sendNotification` function checks `document.hidden` and only fires when tab is not focused. When `sessionId` is provided in options, clicking the notification calls `useStore.getState().setCurrentSession(sessionId)` and `window.focus()`.
  - `web/src/ws.ts` — MODIFY: import `sendNotification` from notifications utility. Add call in `case "result"` block (after `store.setSessionStatus(sessionId, "idle")` on line 227) to send "Session complete" notification with session name. Add call in `case "permission_request"` block (after `store.addPermission` on line 240) to send "Permission needed" notification with tool name.
  - `web/src/utils/notifications.test.ts` — NEW: unit tests for notification utility (mock `Notification`, `document.hidden`)
  - `web/src/ws.test.ts` — ADD tests verifying notification calls fire on result/permission_request messages when tab hidden
- **Contract refs**: component-contract.md (Notification Utility interface), integration-points.md (Notification Triggers section)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - `isNotificationSupported()` returns false when `Notification` not in window
  - `requestNotificationPermission()` calls `Notification.requestPermission()` and returns result
  - `sendNotification()` does nothing when `document.hidden === false`
  - `sendNotification()` creates a `Notification` when `document.hidden === true` and permission is `"granted"`
  - Notification click handler: calls `window.focus()` and switches to the session if `sessionId` provided
  - ws.ts sends notification on `result` message with session name (from `store.sessionNames`)
  - ws.ts sends notification on `permission_request` message with tool name
  - No notifications when tab is focused (document.hidden === false)
  - All existing ws.ts tests still pass
  - New tests cover: utility functions, ws.ts integration points

### Task 2: Context meter threshold adjustment

- **Files**:
  - `web/src/components/TaskPanel.tsx` — MODIFY: line 53, change `contextPct > 50` to `contextPct > 60`
- **Contract refs**: component-contract.md (TaskPanel.tsx Interface)
- **Dependencies**: NONE (can run in parallel with Task 1)
- **Acceptance criteria**:
  - Context meter bar: green 0-60%, yellow 61-80%, red 81%+
  - The 80% red threshold unchanged
  - Visual change only — no logic or prop changes
  - Existing TaskPanel behavior unchanged

## Execution Estimate
- Total tasks: 2
- Independent tasks (no blockers): 2
- Blocked tasks (waiting on other domains): 0
- Estimated checkpoints: 0
