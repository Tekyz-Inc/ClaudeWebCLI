# Domain: auth-middleware

## Purpose
Add bearer token authentication to all API routes and WebSocket connections. Generate token on server start, require it for all requests. Fixes TD-003.

## Owned Files (modify)
- web/server/index.ts — bind to 127.0.0.1, restrict CORS to localhost, add auth middleware
- web/server/routes.ts — apply auth to all route registrations

## New Files (create)
- web/server/auth.ts — token generation, validation middleware, WS auth check

## Tasks
1. Create auth.ts with token generation (random 32-byte hex) and Hono middleware
2. On server start, generate token and print to console (user copies to browser)
3. Add auth middleware to all /api/* routes (Bearer token in Authorization header)
4. Add auth check to WebSocket upgrade (token in query param or header)
5. Restrict CORS to localhost origins only (http://localhost:*)
6. Bind server to 127.0.0.1 instead of 0.0.0.0
7. Update Vite dev proxy to pass auth token
8. Update frontend api.ts to include auth token in requests
9. Update frontend ws.ts to include auth token in WebSocket connections
10. Write tests for auth middleware

## Constraints
- Token displayed on console at startup — user pastes into browser URL param or env
- Frontend reads token from URL param (?token=xxx) or localStorage
- All existing tests must pass (mock auth in test setup)
