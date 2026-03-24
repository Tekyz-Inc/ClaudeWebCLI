# Domain: path-security

## Purpose
Add filesystem path bounds checking, claudeBinary validation, and env var filtering. Fixes TD-002, TD-001 (remaining), TD-010.

## Owned Files (modify)
- web/server/routes/filesystem-routes.ts — add path validation to all fs routes
- web/server/cli-launcher.ts — validate claudeBinary, filter dangerous env vars

## New Files (create)
- web/server/security-utils.ts — path validation, env var denylist, binary allowlist

## Tasks
1. Create security-utils.ts with:
   - validatePath(requestedPath, allowedBase): resolves and checks path is within bounds
   - filterEnvVars(vars): removes dangerous keys (LD_PRELOAD, PYTHONPATH, NODE_OPTIONS, PATH overrides)
   - validateBinary(binary): checks binary name is "claude" or a resolved claude path
2. Apply validatePath to all filesystem-routes (list, tree, read, write, diff)
3. Apply filterEnvVars to cli-launcher.ts env spreading
4. Apply validateBinary to cli-launcher.ts binary resolution
5. Return 403 for path traversal attempts, 400 for invalid binaries
6. Write tests for security-utils

## Constraints
- Path validation uses realpath to resolve symlinks before checking bounds
- Default allowed base: session cwd (from session creation) or process.cwd()
- Binary validation: only allow "claude" by name or paths ending in /claude or \claude
