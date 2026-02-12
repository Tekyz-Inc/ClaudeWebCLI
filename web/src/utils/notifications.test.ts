// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the store before importing
const mockSetCurrentSession = vi.fn();
vi.mock("../store.js", () => ({
  useStore: {
    getState: () => ({ setCurrentSession: mockSetCurrentSession }),
  },
}));

import {
  isNotificationSupported,
  requestNotificationPermission,
  sendNotification,
} from "./notifications.js";

describe("isNotificationSupported", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns true when Notification exists in window", () => {
    vi.stubGlobal("Notification", class {} );
    expect(isNotificationSupported()).toBe(true);
  });

  it("returns false when Notification does not exist", () => {
    const win = window as unknown as Record<string, unknown>;
    const orig = win.Notification;
    delete win.Notification;
    expect(isNotificationSupported()).toBe(false);
    if (orig) win.Notification = orig;
  });
});

describe("requestNotificationPermission", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns denied when Notification not supported", async () => {
    const win = window as unknown as Record<string, unknown>;
    const orig = win.Notification;
    delete win.Notification;
    const result = await requestNotificationPermission();
    expect(result).toBe("denied");
    if (orig) win.Notification = orig;
  });

  it("calls Notification.requestPermission and returns result", async () => {
    const mockReqPerm = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { requestPermission: mockReqPerm });
    const result = await requestNotificationPermission();
    expect(mockReqPerm).toHaveBeenCalled();
    expect(result).toBe("granted");
  });
});

describe("sendNotification", () => {
  let instances: Array<{ title: string; options: unknown; onclick: (() => void) | null; close: () => void }>;

  beforeEach(() => {
    instances = [];

    class MockNotification {
      static permission = "granted";
      title: string;
      options: unknown;
      onclick: (() => void) | null = null;
      close = vi.fn();

      constructor(title: string, options?: unknown) {
        this.title = title;
        this.options = options;
        instances.push(this);
      }
    }

    vi.stubGlobal("Notification", MockNotification);
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  it("does nothing when tab is focused", () => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    sendNotification("Test");
    expect(instances).toHaveLength(0);
  });

  it("does nothing when permission is not granted", () => {
    (Notification as unknown as { permission: string }).permission = "denied";
    sendNotification("Test");
    expect(instances).toHaveLength(0);
  });

  it("creates a notification when tab is hidden and permission granted", () => {
    sendNotification("Test Title", { body: "Test body" });
    expect(instances).toHaveLength(1);
    expect(instances[0].title).toBe("Test Title");
    expect(instances[0].options).toEqual({
      body: "Test body",
      icon: "/favicon.ico",
    });
  });

  it("sets onclick handler when sessionId provided", () => {
    sendNotification("Test", { sessionId: "s1" });
    expect(instances).toHaveLength(1);
    expect(instances[0].onclick).toBeInstanceOf(Function);
  });

  it("onclick focuses window and switches session", () => {
    const mockFocus = vi.fn();
    vi.stubGlobal("focus", mockFocus);

    sendNotification("Test", { sessionId: "s1" });
    // Trigger onclick
    instances[0].onclick!();

    expect(mockSetCurrentSession).toHaveBeenCalledWith("s1");
    expect(instances[0].close).toHaveBeenCalled();
  });

  it("does not set onclick when no sessionId", () => {
    sendNotification("Test", { body: "no session" });
    expect(instances[0].onclick).toBeNull();
  });

  it("does nothing when Notification API is unavailable", () => {
    vi.unstubAllGlobals();
    const win = window as unknown as Record<string, unknown>;
    const orig = win.Notification;
    delete win.Notification;
    sendNotification("Test");
    expect(instances).toHaveLength(0);
    if (orig) win.Notification = orig;
  });
});
