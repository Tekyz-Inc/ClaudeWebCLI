# Backlog

## BL-003: Web Viewer / App Preview
- **Type:** feature
- **Category:** ui
- **App:** claudewebcli
- **Added:** 2026-02-16
- **Description:** Embedded web viewer panel that launches and displays the running web app. Allows users to preview their app directly within the ClaudeWebCLI interface without switching to a separate browser tab.

## BL-004: Web Viewer Context Awareness
- **Type:** feature
- **Category:** ui
- **App:** claudewebcli
- **Added:** 2026-02-16
- **Description:** Make WebCLI aware of the web viewer state so it can identify UI issues and understand prompts that reference the visible UI. Enables context like "fix that button" or "the layout is broken" by connecting what the user sees in the viewer to Claude's understanding.
- **Depends on:** BL-003
