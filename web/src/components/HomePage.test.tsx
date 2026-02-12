// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock all external dependencies
vi.mock("../ws.js", () => ({
  connectSession: vi.fn(),
  waitForConnection: vi.fn().mockResolvedValue(undefined),
  sendToSession: vi.fn(),
  disconnectSession: vi.fn(),
}));

vi.mock("../api.js", () => ({
  api: {
    createSession: vi.fn().mockResolvedValue({ sessionId: "s1" }),
    listDirs: vi.fn().mockResolvedValue([]),
    listEnvs: vi.fn().mockResolvedValue([]),
    getHome: vi.fn().mockResolvedValue({ home: "/home/user", cwd: "/home/user" }),
    getRepoInfo: vi.fn().mockResolvedValue(null),
    listBranches: vi.fn().mockResolvedValue([]),
    gitFetch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../utils/names.js", () => ({
  generateUniqueSessionName: vi.fn(() => "Test Session"),
}));

vi.mock("../utils/recent-dirs.js", () => ({
  getRecentDirs: vi.fn(() => ["/test/project"]),
  addRecentDir: vi.fn(),
}));

vi.mock("./EnvManager.js", () => ({
  EnvManager: () => null,
}));

vi.mock("./FolderPicker.js", () => ({
  FolderPicker: () => null,
}));

let mockStoreState: Record<string, unknown> = {};
const mockAddSession = vi.fn();
const mockSetCurrentSession = vi.fn();
const mockNewSession = vi.fn();

vi.mock("../store.js", () => {
  const useStore = (selector: (state: Record<string, unknown>) => unknown) => {
    return selector(mockStoreState);
  };
  useStore.getState = () => mockStoreState;
  return { useStore };
});

import { HomePage } from "./HomePage.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    sessions: new Map(),
    sessionNames: new Map(),
    currentSessionId: null,
    homeResetKey: 0,
    addSession: mockAddSession,
    setCurrentSession: mockSetCurrentSession,
    setSessionName: vi.fn(),
    markRecentlyRenamed: vi.fn(),
    newSession: mockNewSession,
  };
});

// ─── Permission modes ────────────────────────────────────────────────────────

describe("HomePage permission modes", () => {
  it("renders the default mode label (Agent)", () => {
    render(<HomePage />);
    // The mode dropdown button should show "Agent" by default
    expect(screen.getByText("Agent")).toBeTruthy();
  });

  it("shows all 4 modes in the dropdown", () => {
    render(<HomePage />);
    // Click the mode button to open dropdown
    const modeBtn = screen.getByText("Agent");
    fireEvent.click(modeBtn);

    // "Agent" appears in both the button and dropdown
    expect(screen.getAllByText("Agent").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Accept Edits")).toBeTruthy();
    expect(screen.getByText("Plan")).toBeTruthy();
    expect(screen.getByText("Manual")).toBeTruthy();
  });

  it("shows descriptions for each mode", () => {
    render(<HomePage />);
    const modeBtn = screen.getByText("Agent");
    fireEvent.click(modeBtn);

    expect(screen.getByText("Auto-approve all tool calls")).toBeTruthy();
    expect(screen.getByText("Approve file changes only")).toBeTruthy();
    expect(screen.getByText("Plan before making changes")).toBeTruthy();
    expect(screen.getByText("Approve every tool call")).toBeTruthy();
  });

  it("can select Accept Edits mode", () => {
    render(<HomePage />);
    const modeBtn = screen.getByText("Agent");
    fireEvent.click(modeBtn);

    const acceptEditsBtn = screen.getByText("Accept Edits");
    fireEvent.click(acceptEditsBtn);

    // After selection, the button should show the new mode
    expect(screen.getByText("Accept Edits")).toBeTruthy();
  });
});
