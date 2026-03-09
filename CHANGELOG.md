# Changelog

## [0.11.10] - 2026-03-09

### Added
- Barlow Condensed font for tab/toggle labels and UI chrome
- `highlight.js` for syntax-highlighted code blocks in tool outputs
- Draft persistence: per-project composer text survives project tab switches
- Slash command descriptions shown in the command picker menu
- `SessionHistoryContentBlock` — tool_use blocks returned on resume for side-by-side diff rendering
- `idleTimeout: 0` on WebSocket server to prevent idle browser/CLI disconnects

### Changed
- Slash menu open/close derived from text state (eliminates async race conditions)
- DiffView: compact layout, improved contrast colors
- TaskPanel: Commands section filters to slash commands only
- ProjectTabBar: scroll strip with left/right chevron arrows
- Auto-namer: timeout increased 15 s → 30 s; switched to `--output-format text`
- dev.ts: `--watch` → `--hot` for faster backend reloads

### Fixed
- `CLAUDECODE` env var stripped from CLI spawn — prevents nested-session exit-code-1 error
- Redundant CLI relaunch suppressed when session state is already `"starting"`
- Quieter WebSocket bridge console logging

## [0.10.14] - 2026-03-05

### Added
- "Kill All Sessions" button in sidebar footer — terminates all non-exited SDK sessions in one click

## [0.10.13] - 2026-03-05

### Changed
- Terminal and Session icon-only buttons in TopBar converted to labeled toggle buttons with icon + text

## [0.10.12] - 2026-03-05

### Added
- `GET /api/slash-commands` server endpoint — serves built-in Claude commands plus user skills from `~/.claude/commands/*.md`
- Composer fetches slash commands at mount (module-level cache — one fetch per app session)

### Fixed
- Slash command menu now populated on page load without requiring a CLI session to be active

## [0.10.10] - 2026-03-04

### Added
- Session activity pre-population: resuming a CLI session now pre-fills Files Read, Files Updated, and Commands Executed in the session panel
- `GET /api/claude-sessions/:id/activity` endpoint — parses native `.jsonl` files for tool-use activity
- Sidebar: `+` button next to "Resume Sessions" heading to start a new session from any project tab
- Sidebar: spinner indicator while a session is being resumed; button disabled during resume
- Sidebar: switching project tabs now auto-resumes the most recent native session for that project
- Diff view for code edits: side-by-side before/after with line-level red/green color coding and −/+ prefixes

### Fixed
- Slash command menu (`/`) now opens immediately when the user types `/`, even before the CLI sends its first system_init (was blocked by empty `allCommands` guard)

### Changed
- Chat layout: removed max-width centering, reduced side padding from px-4→px-1, top/bottom from py-6→py-2
- Message font: reduced to text-[11px] across user and assistant bubbles
- Markdown list bullets: replaced browser `list-disc` with compact terminal-style `●` dots
- Composer placeholder text: lighter gray (50% opacity) and italicized

## [0.9.11] - 2026-03-04

### Added
- Session panel: Files Read section (from Read tool calls) and Commands Executed section (Bash tool calls, most recent first)
- Session panel: context bar now color-coded green→yellow→orange→red based on remaining%, with "X% left until compact" label

### Changed
- Session panel Tasks section: smaller fonts, tighter row spacing
- ProjectTabBar running indicator: pulsing dot that grows/shrinks and alternates green↔blue

## [0.9.10] - 2026-03-04

### Added
- Session history pre-population: resuming a native CLI session now loads previous chat messages into the center panel from `.jsonl` files
- `GET /api/claude-sessions/:id/messages` endpoint — parses native `.jsonl` session files into `SessionHistoryMessage[]`
- ProjectTabBar auto-selects the most recently used project on page load (localStorage persistence)

### Changed
- Sidebar redesigned: compact `time · message` inline format, instant fixed-position tooltip (no delay), "RESUME SESSIONS" heading, removed web SDK session list
- Removed all voice/microphone input from Composer and HomePage (STTEngine/Whisper infrastructure retained in workers)

## [0.6.0] - 2026-02-17

### Added
- STT-component toggle mode: `bun run dev --component` runs on ports 3457/5175 using @tekyz/stt-component via Vite resolve.alias swap
- Playwright E2E test infrastructure with 22 tests across dual projects (original + component), covering page load, sidebar, textarea, voice input, dark mode, edge cases, and responsive layout
- Backlog management files (backlog.md, backlog-settings.md) with 4 initial items
- Version label in sidebar footer showing mode and version

### Fixed
- Voice input display flash-clear on stop: hooks now keep state populated until consumer calls `clearState()` after inserting text
- Spacebar duplicating voice text while recording: added `isListening || isProcessing` guard to handleInput in both Composer and HomePage
- Component-mode mid-recording text duplication: `skipFinalsRef` pattern skips Speech API finals after Whisper correction while keeping interims streaming
- Windows `which` command not recognized: use `where` on Windows in cli-launcher.ts and auto-namer.ts
- kill-ports.ps1 PowerShell `$pid` reserved variable conflict: renamed to `$procId`

## [0.14.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.14.0...the-vibe-companion-v0.14.1) (2026-02-10)


### Bug Fixes

* **web:** fix session auto-rename and add blur-to-focus animation ([#86](https://github.com/The-Vibe-Company/companion/issues/86)) ([6d3c91f](https://github.com/The-Vibe-Company/companion/commit/6d3c91f73a65054e2c15727e90ca554af70eed28))
* **web:** improve responsive design across all components ([#85](https://github.com/The-Vibe-Company/companion/issues/85)) ([0750fbb](https://github.com/The-Vibe-Company/companion/commit/0750fbbbe456d79bc104fdbdaf8f08e8795a3b62))

## [0.14.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.13.0...the-vibe-companion-v0.14.0) (2026-02-10)


### Features

* **web:** add embedded code editor with file tree, changed files tracking, and diff view ([#81](https://github.com/The-Vibe-Company/companion/issues/81)) ([3ed0957](https://github.com/The-Vibe-Company/companion/commit/3ed095790c73edeef911ab4c73d74f1998100c5c))
* **web:** session rename persistence + auto-generated titles ([#79](https://github.com/The-Vibe-Company/companion/issues/79)) ([e1dc58c](https://github.com/The-Vibe-Company/companion/commit/e1dc58ce8ab9a619d36f2261cce89b90cfdb70d6))

## [0.13.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.12.1...the-vibe-companion-v0.13.0) (2026-02-10)


### Features

* **web:** replace folder picker dropdown with fixed-size modal ([#76](https://github.com/The-Vibe-Company/companion/issues/76)) ([979e395](https://github.com/The-Vibe-Company/companion/commit/979e395b530cdb21e6a073ba60e33ea8ac497e2a))

## [0.12.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.12.0...the-vibe-companion-v0.12.1) (2026-02-10)


### Bug Fixes

* **web:** isolate worktree sessions with proper branch-tracking ([#74](https://github.com/The-Vibe-Company/companion/issues/74)) ([764d7a7](https://github.com/The-Vibe-Company/companion/commit/764d7a7f5391a686408a8542421f771da341d5db))

## [0.12.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.11.0...the-vibe-companion-v0.12.0) (2026-02-10)


### Features

* **web:** git fetch on branch picker open ([#72](https://github.com/The-Vibe-Company/companion/issues/72)) ([f110405](https://github.com/The-Vibe-Company/companion/commit/f110405edbd0f00454edd65ed72197daf0293182))

## [0.11.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.10.0...the-vibe-companion-v0.11.0) (2026-02-10)


### Features

* **web:** add Clawd-inspired pixel art logo and favicon ([#70](https://github.com/The-Vibe-Company/companion/issues/70)) ([b3994ef](https://github.com/The-Vibe-Company/companion/commit/b3994eff2eac62c3cf8f40a8c31b720c910a7601))
* **web:** enlarge homepage logo as hero element ([#71](https://github.com/The-Vibe-Company/companion/issues/71)) ([18ead74](https://github.com/The-Vibe-Company/companion/commit/18ead7436d3ebbe9d766754ddb17aa504c63703f))


### Bug Fixes

* checkout selected branch when worktree mode is off ([#68](https://github.com/The-Vibe-Company/companion/issues/68)) ([500f3b1](https://github.com/The-Vibe-Company/companion/commit/500f3b112c5ccc646c7965344b5774efe1338377))

## [0.10.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.9.0...the-vibe-companion-v0.10.0) (2026-02-10)


### Features

* **web:** git worktree support with branch picker and git pull ([#65](https://github.com/The-Vibe-Company/companion/issues/65)) ([4d0c9c8](https://github.com/The-Vibe-Company/companion/commit/4d0c9c83f4fe13be863313d6c945ce0b671a7f8a))

## [0.9.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.8.1...the-vibe-companion-v0.9.0) (2026-02-10)


### Features

* claude.md update ([7fa4e7a](https://github.com/The-Vibe-Company/companion/commit/7fa4e7adfdc7c409cfeed4e8a11f237ff0572234))
* **web:** add git worktree support for isolated multi-branch sessions ([#64](https://github.com/The-Vibe-Company/companion/issues/64)) ([fee39d6](https://github.com/The-Vibe-Company/companion/commit/fee39d62986cd99700ba78c84a1f586331955ff8))

## [0.8.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.8.0...the-vibe-companion-v0.8.1) (2026-02-10)


### Bug Fixes

* **web:** chat scroll and composer visibility in plan mode ([#55](https://github.com/The-Vibe-Company/companion/issues/55)) ([4cff10c](https://github.com/The-Vibe-Company/companion/commit/4cff10cde297b7142c088584b6dd83060902c526))

## [0.8.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.7.0...the-vibe-companion-v0.8.0) (2026-02-10)


### Features

* **web:** archive sessions instead of deleting them ([#56](https://github.com/The-Vibe-Company/companion/issues/56)) ([489d608](https://github.com/The-Vibe-Company/companion/commit/489d6087fc99b9131386547edaf3bd303a114090))

## [0.7.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.6.1...the-vibe-companion-v0.7.0) (2026-02-10)


### Features

* **web:** named environment profiles (~/.companion/envs/) ([#50](https://github.com/The-Vibe-Company/companion/issues/50)) ([eaa1a49](https://github.com/The-Vibe-Company/companion/commit/eaa1a497f3be61f2f71f9467e93fa2b65be19095))

## [0.6.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.6.0...the-vibe-companion-v0.6.1) (2026-02-10)


### Bug Fixes

* **web:** session reconnection with auto-relaunch and persist ([#49](https://github.com/The-Vibe-Company/companion/issues/49)) ([f58e542](https://github.com/The-Vibe-Company/companion/commit/f58e5428847a342069e6790fa7d70f190bc5f396))
* **web:** use --resume on CLI relaunch to restore conversation context ([#46](https://github.com/The-Vibe-Company/companion/issues/46)) ([3e2b5bd](https://github.com/The-Vibe-Company/companion/commit/3e2b5bdd39bd265ca5675784227a9f1b4f2a8aa3))

## [0.6.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.5.0...the-vibe-companion-v0.6.0) (2026-02-10)


### Features

* **web:** git info display, folder dropdown fix, dev workflow ([#43](https://github.com/The-Vibe-Company/companion/issues/43)) ([1fe2069](https://github.com/The-Vibe-Company/companion/commit/1fe2069a7db17b410e383f883c934ee1662c2171))
* **web:** persist sessions to disk for dev mode resilience ([#45](https://github.com/The-Vibe-Company/companion/issues/45)) ([c943d00](https://github.com/The-Vibe-Company/companion/commit/c943d0047b728854f059e26facde950e08cdfe0c))

## [0.5.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.4.0...the-vibe-companion-v0.5.0) (2026-02-09)


### Features

* **web:** add permission suggestions and pending permission indicators ([10422c1](https://github.com/The-Vibe-Company/companion/commit/10422c1464b6ad4bc45eb90e6cd9ebbc0ebeac92))

## [0.4.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.3.0...the-vibe-companion-v0.4.0) (2026-02-09)


### Features

* **web:** add component playground and ExitPlanMode display ([#36](https://github.com/The-Vibe-Company/companion/issues/36)) ([e958be7](https://github.com/The-Vibe-Company/companion/commit/e958be780f1b6e1a8f65daedbf968cdf6ef47798))

## [0.3.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.2.2...the-vibe-companion-v0.3.0) (2026-02-09)


### Features

* allow dev server access over Tailscale/LAN ([#33](https://github.com/The-Vibe-Company/companion/issues/33)) ([9599d7a](https://github.com/The-Vibe-Company/companion/commit/9599d7ad4e2823d51c8fa262e1dcd96eeb056244))


### Bug Fixes

* scope permission requests to their session tab ([#35](https://github.com/The-Vibe-Company/companion/issues/35)) ([ef9f41c](https://github.com/The-Vibe-Company/companion/commit/ef9f41c8589e382de1db719984931bc4e91aeb11))

## [0.2.2](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.2.1...the-vibe-companion-v0.2.2) (2026-02-09)


### Bug Fixes

* remove vibe alias, update repo URLs to companion ([#30](https://github.com/The-Vibe-Company/companion/issues/30)) ([4f7b47c](https://github.com/The-Vibe-Company/companion/commit/4f7b47cba86c278e89fe81292fea9b8b3e75c035))
* show pasted images in chat history ([#32](https://github.com/The-Vibe-Company/companion/issues/32)) ([46365be](https://github.com/The-Vibe-Company/companion/commit/46365be45ae8b325100ed296617455c105d4d52e))

## [0.2.1](https://github.com/The-Vibe-Company/claude-code-controller/compare/the-vibe-companion-v0.2.0...the-vibe-companion-v0.2.1) (2026-02-09)


### Bug Fixes

* track all commits in release-please, not just web/ ([#27](https://github.com/The-Vibe-Company/claude-code-controller/issues/27)) ([d49f649](https://github.com/The-Vibe-Company/claude-code-controller/commit/d49f64996d02807baf0482ce3c3607ae59f78638))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([e296ab0](https://github.com/The-Vibe-Company/claude-code-controller/commit/e296ab0fabd6345b1f21c7094ca1f8d6f6af79cb))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([#26](https://github.com/The-Vibe-Company/claude-code-controller/issues/26)) ([61eed5a](https://github.com/The-Vibe-Company/claude-code-controller/commit/61eed5addd6e332fac360d9ae8239f1b0f93868e))
