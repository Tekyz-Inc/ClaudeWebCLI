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
  it("renders the default mode label (Bypass Permissions)", () => {
    render(<HomePage />);
    expect(screen.getByText("Bypass Permissions")).toBeTruthy();
  });

  it("cycles through modes on click", () => {
    render(<HomePage />);
    const modeBtn = screen.getByText("Bypass Permissions");

    // Click to cycle to Accept Edits
    fireEvent.click(modeBtn);
    expect(screen.getByText("Accept Edits")).toBeTruthy();

    // Click to cycle to Plan
    fireEvent.click(screen.getByText("Accept Edits"));
    expect(screen.getByText("Plan")).toBeTruthy();

    // Click to cycle to Manual
    fireEvent.click(screen.getByText("Plan"));
    expect(screen.getByText("Manual")).toBeTruthy();

    // Click to cycle back to Bypass Permissions
    fireEvent.click(screen.getByText("Manual"));
    expect(screen.getByText("Bypass Permissions")).toBeTruthy();
  });
});
