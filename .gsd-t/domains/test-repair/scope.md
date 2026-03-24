# Domain: test-repair

## Purpose
Fix all 96 failing tests by updating mocks, assertions, and test expectations to match current source code.

## Owned Files
- web/src/ws.test.ts (22 failures)
- web/src/components/Sidebar.test.tsx (26 failures)
- web/src/components/Composer.test.tsx (19 failures)
- web/src/components/ToolBlock.test.tsx (8 failures)
- web/src/components/MessageFeed.test.tsx (6 failures)
- web/server/git-utils.test.ts (5 failures)
- web/server/auto-namer.test.ts (4 failures)
- web/src/components/EditorPanel.test.tsx (2 failures)
- web/server/cli-launcher.test.ts (2 failures)
- web/server/routes.test.ts (1 failure)
- web/src/components/MessageBubble.test.tsx (1 failure)

## Constraints
- Do NOT modify source code — only test files
- Update mocks to match current store shape (new fields, renamed actions)
- Update component test expectations to match current DOM structure
- Update spawn mocking for current CLI launcher patterns
- Pre-existing 5 Windows path failures in git-utils.test.ts are OUT OF SCOPE (TD-011)

## Success Criteria
- 0 test failures (excluding 5 Windows path failures)
- No test file modifications break source functionality
