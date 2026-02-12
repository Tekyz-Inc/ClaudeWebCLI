# Constraints: ghost-ux

## Must Follow
- Use existing Tailwind theme tokens (`text-cc-muted`, `text-cc-fg`, etc.)
- Ghost text: lighter color (e.g., `text-cc-muted` or `opacity-50`)
- Solid text: normal color (`text-cc-fg`)
- Transition should be subtle (200-300ms fade)
- Textarea must remain editable during ghost state
- Auto-resize must still work with ghost text

## Must Not
- Modify files outside owned scope
- Add new npm dependencies
- Change existing non-voice behavior in Composer or HomePage
- Modify the send flow or slash command behavior

## Dependencies
- Depends on: client-formatter domain (needs `useDictationFormatter` hook interface)
- Depended on by: nothing
