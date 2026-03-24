# Domain: terminal-fix

## Purpose
Fix terminal panel keyboard input not working when the right panel slides out. User types but nothing appears in the terminal.

## Owned Files
- web/src/components/TerminalPanel.tsx
- web/src/App.tsx (if focus management needed)

## Investigation Areas
1. Focus stealing: Composer textarea may capture focus when terminal slides out
2. CSS transition timing: 100ms setTimeout for term.focus() may fire before panel is fully visible
3. tabIndex / focus trap: xterm may need explicit tabIndex or focus trap removal
4. Event propagation: parent elements may be intercepting keyboard events

## Constraints
- Minimal changes — fix the focus issue, don't restructure the component
- Ensure clicking in terminal area always focuses xterm
- Ensure keyboard works immediately when panel opens (no click required)
- Test manually since xterm renders to canvas (not DOM-testable)
