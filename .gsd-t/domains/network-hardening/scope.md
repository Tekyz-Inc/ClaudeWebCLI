# Domain: network-hardening

## Purpose
Add security headers, WebSocket message limits, rate limiting, secret masking, and session storage hardening. Fixes TD-008, TD-009, TD-015, TD-017, TD-018.

## Owned Files (modify)
- web/server/index.ts — security headers middleware, WS maxPayloadLength, rate limiting
- web/server/routes/environment-routes.ts — mask secret values in responses
- web/server/session-store.ts — move session storage to ~/.companion/sessions/

## New Files (create)
- web/server/rate-limiter.ts — simple in-memory rate limiter (sessions/min, requests/min)

## Tasks
1. Add security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
2. Set WebSocket maxPayloadLength to 1MB
3. Create rate-limiter.ts — max 10 sessions/minute, max 100 requests/minute per IP
4. Apply rate limiter to session creation and all API routes
5. Mask environment variable values in GET /api/envs responses (show first 3 chars + ***)
6. Add reveal endpoint: GET /api/envs/:slug/reveal (requires auth)
7. Move session-store from $TMPDIR/vibe-sessions/ to ~/.companion/sessions/ with 0700 permissions
8. Write tests for rate limiter and secret masking

## Constraints
- Rate limiter: in-memory, resets on server restart (no persistence needed)
- Secret masking: mask any value > 4 chars, keep short values visible
- Session storage migration: if old location exists, migrate on first startup
