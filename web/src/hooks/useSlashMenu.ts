import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api } from "../api.js";

export interface CommandItem {
  name: string;
  type: "command" | "skill";
  description?: string;
  argumentHint?: string;
}

export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  "add-dir": "Add directories to context",
  approve: "Approve a pending tool request",
  btw: "Send a background note to Claude",
  bug: "Report a bug",
  clear: "Clear the current conversation",
  compact: "Compact conversation to save context",
  config: "View or change configuration",
  context: "Show current context usage",
  cost: "Show token usage and cost",
  doctor: "Check Claude Code health",
  exit: "Exit the current session",
  "extra-usage": "Show extended usage stats",
  help: "Show available commands and help",
  init: "Initialize CLAUDE.md in project",
  insights: "Show conversation insights",
  login: "Log in to Claude",
  logout: "Log out of Claude",
  memory: "Manage Claude memories",
  model: "Switch the active model",
  multiline: "Toggle multiline input mode",
  permission: "View or set permission mode",
  "pr-comments": "Fetch PR review comments",
  quit: "Quit the current session",
  reject: "Reject a pending tool request",
  "release-notes": "Show recent release notes",
  resume: "Resume a previous session",
  review: "Review code changes",
  "security-review": "Security review of code changes",
  status: "Show session status",
  terminal: "Open an embedded terminal",
  vim: "Enable vim keybindings",
};

// Module-level cache: fetched once on first mount, reused on remounts
let _cachedSlashCommands: {
  commands: string[];
  skills: string[];
  argumentHints?: Record<string, string>;
} | null = null;

export interface UseSlashMenuReturn {
  slashMenuOpen: boolean;
  slashMenuIndex: number;
  setSlashMenuIndex: React.Dispatch<React.SetStateAction<number>>;
  filteredCommands: CommandItem[];
  allCommands: CommandItem[];
  menuRef: React.RefObject<HTMLDivElement>;
  selectCommand: (cmd: CommandItem, setText: (t: string) => void, focusTextarea: () => void) => void;
  closeMenu: (text: string) => void;
  fetchedCommands: { commands: string[]; skills: string[]; argumentHints?: Record<string, string> } | null;
}

export function useSlashMenu(
  text: string,
  sessionSlashCommands?: string[],
  sessionSkills?: string[],
): UseSlashMenuReturn {
  const [slashMenuEscapedText, setSlashMenuEscapedText] = useState<string | null>(null);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [fetchedCommands, setFetchedCommands] = useState<{
    commands: string[];
    skills: string[];
    argumentHints?: Record<string, string>;
  } | null>(_cachedSlashCommands);
  const menuRef = useRef<HTMLDivElement>(null!);

  const slashQuery = text.match(/^\/(\S*)$/);
  const slashMenuOpen = !!slashQuery && slashMenuEscapedText !== text;

  // Fetch available commands once at mount
  useEffect(() => {
    if (_cachedSlashCommands) return;
    api.getSlashCommands()
      .then((data) => {
        _cachedSlashCommands = data;
        setFetchedCommands(data);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [];
    const hints = fetchedCommands?.argumentHints ?? {};

    const cmdSet = new Set<string>([
      ...(sessionSlashCommands ?? []),
      ...(fetchedCommands?.commands ?? []),
    ]);
    for (const cmd of cmdSet) {
      const name = cmd.startsWith("/") ? cmd.slice(1) : cmd;
      cmds.push({
        name,
        type: "command",
        description: COMMAND_DESCRIPTIONS[name],
        argumentHint: hints[name],
      });
    }

    const skills = (sessionSkills?.length ? sessionSkills : null) ?? (fetchedCommands?.skills ?? []);
    for (const skill of skills) {
      const name = skill.startsWith("/") ? skill.slice(1) : skill;
      const hint = hints[`user:${name}`] ?? hints[name];
      cmds.push({ name, type: "skill", description: "User skill", argumentHint: hint });
    }

    if (import.meta.env.DEV && cmds.length > 0) {
      console.log("[Composer] slash commands loaded:", cmds.length, cmds.slice(0, 5).map((c) => `/${c.name}`));
    }
    return cmds;
  }, [sessionSlashCommands, sessionSkills, fetchedCommands]);

  const filteredCommands = useMemo<CommandItem[]>(() => {
    const match = text.match(/^\/(\S*)$/);
    if (!match) return [];
    const query = match[1].toLowerCase();
    if (query === "") return allCommands;
    return allCommands.filter((cmd) => cmd.name.toLowerCase().includes(query));
  }, [text, allCommands]);

  // Reset index to 0 whenever menu opens
  useEffect(() => {
    if (slashMenuOpen) setSlashMenuIndex(0);
  }, [slashMenuOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (slashMenuIndex >= filteredCommands.length) {
      setSlashMenuIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, slashMenuIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!menuRef.current || !slashMenuOpen) return;
    const items = menuRef.current.querySelectorAll("[data-cmd-index]");
    const selected = items[slashMenuIndex];
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }, [slashMenuIndex, slashMenuOpen]);

  const selectCommand = useCallback(
    (cmd: CommandItem, setText: (t: string) => void, focusTextarea: () => void) => {
      setText(`/${cmd.name} `);
      focusTextarea();
    },
    [],
  );

  function closeMenu(currentText: string) {
    setSlashMenuEscapedText(currentText);
  }

  return {
    slashMenuOpen,
    slashMenuIndex,
    setSlashMenuIndex,
    filteredCommands,
    allCommands,
    menuRef,
    selectCommand,
    closeMenu,
    fetchedCommands,
  };
}
