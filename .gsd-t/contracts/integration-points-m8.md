# Integration Points — Milestone 8: Codebase Refactor & Stability

## Execution Order (Dependencies)

```
Wave 1: test-repair + terminal-fix (independent, parallel)
Wave 2: server-async (changes function signatures — tests already fixed in Wave 1)
Wave 3: client-decomposition (restructures imports — server already async)
Wave 4: route-modularization (depends on server-async for async route handlers)
```

## Cross-Domain Contracts

### test-repair → all other domains
- Tests are fixed FIRST so subsequent refactors can verify correctness
- Other domains must re-run full test suite after changes

### server-async → route-modularization
- git-utils functions become async → route handlers must await them
- route-modularization should import already-async functions

### server-async → client-decomposition
- ws-bridge session init becomes async → no client impact (server-internal)
- session-store becomes async → no client impact

### client-decomposition internal contracts
- store.ts split: slices must export same action names and state shape
- ws.ts split: handlers must receive (sessionId, data, store) and call same store actions
- Shared hooks: useImageAttachments returns { images, setImages, handleFileSelect, handlePaste, handleDrop, removeImage }
- Shared utils: toolGrouping.ts exports groupToolUseBlocks(blocks: ContentBlock[])

### terminal-fix
- Independent — no cross-domain dependencies
- May touch App.tsx focus management (shared with client-decomposition)
- Execute in Wave 1 to avoid conflicts
