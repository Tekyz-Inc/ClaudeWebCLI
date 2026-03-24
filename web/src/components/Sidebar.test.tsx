// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { SdkSessionInfo } from "../types.js";

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockConnectSession = vi.fn();
const mockDisconnectSession = vi.fn();

vi.mock("../ws.js", () => ({
  connectSession: (...args: unknown[]) => mockConnectSession(...args),
  disconnectSession: (...args: unknown[]) => mockDisconnectSession(...args),
}));

const mockApi = {
  listSessions: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue({}),
  archiveSession: vi.fn().mockResolvedValue({}),
  unarchiveSession: vi.fn().mockResolvedValue({}),
  getClaudeSessions: vi.fn().mockResolvedValue([]),
  killSession: vi.fn().mockResolvedValue({}),
};

vi.mock("../api.js", () => ({
  api: {
    listSessions: (...args: unknown[]) => mockApi.listSessions(...args),
    deleteSession: (...args: unknown[]) => mockApi.deleteSession(...args),
    archiveSession: (...args: unknown[]) => mockApi.archiveSession(...args),
    unarchiveSession: (...args: unknown[]) => mockApi.unarchiveSession(...args),
    getClaudeSessions: (...args: unknown[]) => mockApi.getClaudeSessions(...args),
    killSession: (...args: unknown[]) => mockApi.killSession(...args),
  },
}));

// Mock EnvManager to avoid rendering complexity
vi.mock("./EnvManager.js", () => ({
  EnvManager: () => <div data-testid="env-manager">EnvManager</div>,
}));

// ─── Store mock helpers ──────────────────────────────────────────────────────

interface MockStoreState {
  sessions: Map<string, unknown>;
  sdkSessions: SdkSessionInfo[];
  currentSessionId: string | null;
  darkMode: boolean;
  cliConnected: Map<string, boolean>;
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;
  sessionNames: Map<string, string>;
  recentlyRenamed: Set<string>;
  pendingPermissions: Map<string, Map<string, unknown>>;
  activeProjectCwd: string | null;
  hiddenProjects: Set<string>;
  projectSessionMap: Map<string, string>;
  messages: Map<string, unknown[]>;
  setCurrentSession: ReturnType<typeof vi.fn>;
  toggleDarkMode: ReturnType<typeof vi.fn>;
  removeSession: ReturnType<typeof vi.fn>;
  newSession: ReturnType<typeof vi.fn>;
  setSidebarOpen: ReturnType<typeof vi.fn>;
  setSessionName: ReturnType<typeof vi.fn>;
  markRecentlyRenamed: ReturnType<typeof vi.fn>;
  clearRecentlyRenamed: ReturnType<typeof vi.fn>;
  setSdkSessions: ReturnType<typeof vi.fn>;
  resumeNativeSession: ReturnType<typeof vi.fn>;
}

let mockState: MockStoreState;

function createMockState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    sessions: new Map(),
    sdkSessions: [],
    currentSessionId: null,
    darkMode: false,
    cliConnected: new Map(),
    sessionStatus: new Map(),
    sessionNames: new Map(),
    recentlyRenamed: new Set(),
    pendingPermissions: new Map(),
    activeProjectCwd: null,
    hiddenProjects: new Set(),
    projectSessionMap: new Map(),
    messages: new Map(),
    setCurrentSession: vi.fn(),
    toggleDarkMode: vi.fn(),
    removeSession: vi.fn(),
    newSession: vi.fn(),
    setSidebarOpen: vi.fn(),
    setSessionName: vi.fn(),
    markRecentlyRenamed: vi.fn(),
    clearRecentlyRenamed: vi.fn(),
    setSdkSessions: vi.fn(),
    resumeNativeSession: vi.fn(),
    ...overrides,
  };
}

// Mock the store module
vi.mock("../store.js", () => {
  // We create a function that acts like the zustand hook with selectors
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => {
    return selector(mockState);
  };
  // Also support useStore.getState() which Sidebar uses directly
  useStoreFn.getState = () => mockState;

  return { useStore: useStoreFn };
});

// ─── Import component after mocks ───────────────────────────────────────────

import { Sidebar } from "./Sidebar.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockState = createMockState();
});

describe("Sidebar", () => {
  it("renders 'Select a project tab to see sessions.' when no project active", () => {
    render(<Sidebar />);
    expect(screen.getByText("Select a project tab to see sessions.")).toBeInTheDocument();
  });

  it("renders 'No sessions for this project.' when project active but no native sessions", async () => {
    mockApi.getClaudeSessions.mockResolvedValue([]);
    mockState = createMockState({ activeProjectCwd: "/test/project" });

    await act(async () => {
      render(<Sidebar />);
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText("No sessions for this project.")).toBeInTheDocument();
  });

  it("renders Kill All Sessions button in footer", () => {
    render(<Sidebar />);
    const killBtn = screen.getByTitle("Kill all sessions");
    expect(killBtn).toBeInTheDocument();
  });

  it("renders Environments button in footer", () => {
    render(<Sidebar />);
    const envBtn = screen.getByTitle("Environments");
    expect(envBtn).toBeInTheDocument();
  });

  it("dark mode button toggles theme (light mode shows moon icon)", () => {
    mockState = createMockState({ darkMode: false });

    render(<Sidebar />);
    const darkModeButton = screen.getByTitle("Switch to dark mode");
    expect(darkModeButton).toBeInTheDocument();
    fireEvent.click(darkModeButton);

    expect(mockState.toggleDarkMode).toHaveBeenCalled();
  });

  it("dark mode button shows sun icon when dark mode is active", () => {
    mockState = createMockState({ darkMode: true });

    render(<Sidebar />);
    const lightModeButton = screen.getByTitle("Switch to light mode");
    expect(lightModeButton).toBeInTheDocument();
  });

  describe("native sessions", () => {
    const fakeNativeSession = {
      id: "native-session-id",
      cwd: "/test/project",
      firstMessage: "Hello from terminal",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isNative: true as const,
    };

    it("renders 'Resume Sessions' section when project active and api returns sessions", async () => {
      mockApi.getClaudeSessions.mockResolvedValue([fakeNativeSession]);
      mockState = createMockState({
        activeProjectCwd: "/test/project",
      });

      await act(async () => {
        render(<Sidebar />);
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(screen.queryByText("Resume Sessions")).toBeTruthy();
    });

    it("renders native session first message preview", async () => {
      mockApi.getClaudeSessions.mockResolvedValue([fakeNativeSession]);
      mockState = createMockState({
        activeProjectCwd: "/test/project",
      });

      await act(async () => {
        render(<Sidebar />);
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(screen.queryByText("Hello from terminal")).toBeTruthy();
    });

    it("calls resumeNativeSession when native session button is clicked", async () => {
      mockApi.getClaudeSessions.mockResolvedValue([fakeNativeSession]);
      mockState = createMockState({
        activeProjectCwd: "/test/project",
        resumeNativeSession: vi.fn().mockResolvedValue(undefined),
      });

      await act(async () => {
        render(<Sidebar />);
        await new Promise((r) => setTimeout(r, 50));
      });

      // Native session renders as a button — click it
      const sessionBtn = screen.queryByText("Hello from terminal")?.closest("button");
      expect(sessionBtn).toBeTruthy();
      fireEvent.click(sessionBtn!);
      expect(mockState.resumeNativeSession).toHaveBeenCalledWith("native-session-id", "/test/project");
    });

    it("does NOT show native sessions section when no project active", async () => {
      mockApi.getClaudeSessions.mockResolvedValue([fakeNativeSession]);
      mockState = createMockState({
        activeProjectCwd: null,
      });

      await act(async () => {
        render(<Sidebar />);
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(screen.queryByText("Resume Sessions")).toBeNull();
    });

    it("shows '(no message)' when firstMessage is null", async () => {
      mockApi.getClaudeSessions.mockResolvedValue([{
        ...fakeNativeSession,
        firstMessage: null,
      }]);
      mockState = createMockState({
        activeProjectCwd: "/test/project",
      });

      await act(async () => {
        render(<Sidebar />);
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(screen.queryByText("(no message)")).toBeTruthy();
    });

    it("does not call getClaudeSessions when activeProjectCwd is null", () => {
      mockState = createMockState({ activeProjectCwd: null });
      render(<Sidebar />);
      // The api should not be called without a project CWD
      expect(mockApi.getClaudeSessions).not.toHaveBeenCalled();
    });

    it("calls getClaudeSessions with the active project CWD", async () => {
      mockApi.getClaudeSessions.mockResolvedValue([]);
      mockState = createMockState({ activeProjectCwd: "/my/project" });

      await act(async () => {
        render(<Sidebar />);
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockApi.getClaudeSessions).toHaveBeenCalledWith("/my/project");
    });
  });
});
