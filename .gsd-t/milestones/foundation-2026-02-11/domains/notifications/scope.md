# Domain: notifications

## Responsibility

Desktop notifications for session events (task completion, permission requests) using the browser Notification API, plus a minor context meter threshold adjustment in TaskPanel.

## Features

1. **Desktop Notifications** — Request notification permission on first use. Send browser notifications when: (a) a session completes a query (result message) while the tab is not focused, (b) a permission request arrives while the tab is not focused. Include session name in notification title. Clicking the notification focuses the tab and switches to the relevant session.
2. **Context Meter Threshold Adjustment** — Update color thresholds from current 50%/80% to 60%/80% to match the milestone spec (green 0-60%, yellow 60-80%, red 80%+). This is a 1-line change in TaskPanel.tsx.

## Owned Files/Directories

- `web/src/utils/notifications.ts` — NEW: Notification API utility (permission request, send notification, click handling)
- `web/src/ws.ts` — MODIFY: add notification triggers on `result` and `permission_request` messages
- `web/src/components/TaskPanel.tsx` — MODIFY: adjust context meter threshold (50 → 60)
- `web/src/utils/notifications.test.ts` — NEW: tests for notification utility
- `web/src/ws.test.ts` — MODIFY: add tests for notification integration

## NOT Owned (do not modify)

- `web/src/components/Composer.tsx` — owned by input-enhancements domain
- `web/src/components/HomePage.tsx` — owned by session-config domain
- `web/src/store.ts` — shared; see store-contract.md for allowed modifications
- `web/server/` — no server changes in this domain
