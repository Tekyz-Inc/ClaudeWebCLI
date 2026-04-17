# CLAUDE.md Optimization Plan

Date: 2026-04-17
Before: 11,611 chars
Target: remove duplication with `~/.claude/CLAUDE.md` while preserving all OVERRIDE + PROJECT-SPECIFIC content.

---

## (a) DUPLICATE-OF-GLOBAL — deleted

These restate rules already enforced by the inherited global CLAUDE.md.

- **`## GSD Workflow Preferences` → `### Research Policy`** (lines 126–142) — verbatim copy of global "Workflow Preferences → Research Policy" section. Delete.
- **`### Execution` sub-bullets** (lines 120–124) — "ALWAYS self-verify", "NEVER pause to show verification steps", "ONLY run Discussion phase if truly required" all duplicate the global "Execution Behavior" and "Phase Flow" rules. The "/clear between phases" bullet is not in global but is GSD-T harness behavior, not a project rule.
- **`## Code Patterns to Follow`** (lines 180–185) — "Type hints required", "Functions under 30 lines", "Files under 200 lines" duplicate global "Code Standards → Patterns". The "Async/await for all I/O" and "TypeScript strict mode" bullets are project-specific and are preserved in the `Don't Do These Things` section instead.
- **`## Destructive Action Guard` preamble** (lines 235–237, 246) — first paragraph and closing "Rule" line duplicate global "Destructive Action Guard" intro and "Adapt to what exists" line. Keep only the project-specific bullets (WebSocket protocol format, etc.).
- **`## GSD-T Workflow` section** (lines 275–279) — "State: .gsd-t/progress.md / Contracts: .gsd-t/contracts/ / Domains: .gsd-t/domains/" duplicates the global Living Documents table. Delete.
- **`**Model assignments:**` block** (lines 281–284) — verbatim duplicate of the global Model Display section's model-assignment bullets. Delete.
- **`## Autonomy Level` prose** ("Only pause for blockers or project completion. Execute phases continuously.") — restates the Level 3 definition from the global Autonomy Levels table. The heading + Level declaration itself is an OVERRIDE (see below); the explanatory prose is duplicate.

## (b) OVERRIDE-OF-GLOBAL — kept (with marker)

- **`## Branch Guard`** — Project-specific override declaring the expected branch. Keep; global Pre-Commit Gate references "Expected branch in project CLAUDE.md".
- **`## Autonomy Level` — Level 3 declaration** — Overrides the global default-if-unspecified clause by explicitly pinning Level 3. Keep.
- **`## Destructive Action Guard`** (project-specific bullets only) — Tightens global guard with WebSocket-protocol-specific items. Keep as override.
- **`## API Documentation Waiver`** — Explicit waiver of the global API Documentation Guard. Keep (this is the canonical override).
- **`## Don't Do These Things`** — Project-specific "NEVER" rules (TypeScript strict mode, sync I/O, credentials, NDJSON protocol, feature-without-tests, data-dependent tests). Keep; overrides/extends global Don't list.
- **`### Test Requirements`** — Tighter than global (specific port cleanup 3458/5174, fixture requirement). Keep.

## (c) PROJECT-SPECIFIC — kept

- `# ClaudeWebCLI` title
- `## Project Overview` — describes the `--sdk-url` bridge
- `### Architecture (Three-Tier WebSocket Bridge)` diagram
- `### How --sdk-url Works` — CLI launch command
- `## Where Things Live` table — file-path map
- `## Key Technologies` — stack list
- `## The --sdk-url WebSocket Protocol` — connection lifecycle, message types, tool approval, auth
- `## Documentation` — paths to docs/*.md
- `## Testing` → Framework, Test File Organization, Test Naming, Running Tests, Test Requirements — all reference specific project directories and port numbers
- `### Naming Conventions` — kebab-case/camelCase overrides the global snake_case defaults (TypeScript convention)
- `## Running the App` — First-time setup, Dev server, Windows/Bitdefender notes, Port strategy, Clearing stuck ports, Production build, Session policy
- `## Reference Projects` — external repo links used for protocol research

## (d) STALE — deleted

None found. All file paths, commands, and references still point at live locations in the repo.

---

## Notes on kept sections that look generic

- `### Naming Conventions` stays intact because it **overrides** global snake_case with camelCase/kebab-case — flagged in the instructions to preserve when it overrides.
- `## Testing` stays intact because it names specific test files, directories, ports, and npm scripts (project-specific by constraint).
- `## Running the App` stays intact because it contains command sequences and port numbers unique to this repo.

---

## Report

| Metric | Value |
|--------|-------|
| Before | 11,611 chars |
| After  | 10,028 chars |
| Delta  | −1,583 chars |
| Reduction | 13.6% |

### Top-5 largest deletions (by char count)

1. **`## GSD Workflow Preferences` → `### Research Policy`** block (~750 chars) — full "Run research when / Skip research when" list duplicates global Workflow Preferences.
2. **`## Code Patterns to Follow`** block (~400 chars) — Type hints / function-length / file-length rules duplicate global Code Standards → Patterns. Kept only the TypeScript/async/env/NDJSON NEVER rules in `Don't Do These Things`.
3. **`## Destructive Action Guard` preamble + closing rule** (~290 chars) — first paragraph ("This applies at ALL autonomy levels...") and trailing "Adapt new code to existing structures" restate global guard intro.
4. **`## GSD-T Workflow` section** (~180 chars) — "State / Contracts / Domains" path listing duplicates global Living Documents table.
5. **`### Execution` sub-bullets under GSD Workflow Preferences** (~270 chars) — "ALWAYS self-verify", "NEVER pause to show verification steps" duplicate global Execution Behavior.

### Also removed (smaller)

- `**Model assignments:**` block (~470 chars) — full duplicate of global Model Display model-assignment bullets.
- `## Autonomy Level` explanatory sentence — kept the Level 3 declaration (override), removed the restated definition.

### Sections kept intact per constraints

- Tech stack, Project Overview, Architecture diagram, Where Things Live, Key Technologies, `--sdk-url` WebSocket Protocol, Testing (all subsections), Running the App, Reference Projects — all contain specific file paths, ports, or commands and are preserved in full.
- `### Naming Conventions` — preserved as an explicit override (TypeScript kebab/camel vs global snake_case).
- `### Test Requirements` — preserved (port cleanup 3458/5174 is project-specific).

