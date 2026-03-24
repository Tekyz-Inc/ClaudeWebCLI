# Integration Points — Milestone 9: Security Hardening

## Execution Order (Dependencies)

```
Wave 1: path-security (no dependencies, pure server-side)
Wave 2: auth-middleware (needs path-security done so routes are already secured)
Wave 3: network-hardening (needs auth for reveal endpoint, builds on secured foundation)
```

## Cross-Domain Contracts

### path-security → auth-middleware
- Path validation functions must be importable by auth middleware if needed
- filesystem-routes already modified — auth-middleware just wraps them

### auth-middleware → network-hardening
- Auth token system must be in place before rate limiter (rate limits apply to authenticated requests)
- Reveal endpoint needs auth to be functional

### network-hardening (internal)
- Secret masking on GET /api/envs — add reveal endpoint behind auth
- Session storage migration is independent of other changes
