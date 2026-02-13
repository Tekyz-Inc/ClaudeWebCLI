# API Contract — Milestone 2: Smart Voice Dictation

## POST /api/format-dictation

Formats raw dictated text with contextual punctuation, capitalization, and number formatting using a one-shot Claude CLI process.

**Request:**
```typescript
{
  text: string;        // Raw dictated text (max 2000 chars, truncated server-side)
  model?: string;      // Model to use (default: "claude-haiku-4-5-20251001")
}
```

**Response (success):**
```typescript
{
  formatted: string;   // Formatted text with punctuation, caps, numbers
  changed: boolean;    // Whether any changes were made
}
```

**Response (error):**
```typescript
{
  error: string;       // Error description
  formatted: null;
  changed: false;
}
```

**Behavior:**
- Uses `Bun.spawn()` to run one-shot `claude -p` with formatting prompt
- Timeout: 15 seconds (returns error if exceeded)
- Empty/whitespace-only input: returns `{ formatted: text, changed: false }`
- CLI failure: returns error response (client keeps raw text)
- Model defaults to Haiku for speed; caller can override
- Formatting instructions embedded in prompt (no --system-prompt flag)
- Binary resolution: uses `where` on Windows, `which` on Unix

**Owner:** server-formatter domain
**Consumers:** client-formatter domain (via `api.formatDictation()`)
