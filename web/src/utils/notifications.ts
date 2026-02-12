import { useStore } from "../store.js";

/** Check if browser Notification API is available */
export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

/** Request notification permission from user */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  return Notification.requestPermission();
}

/**
 * Send a desktop notification (only when tab is not focused).
 * If sessionId is provided, clicking the notification switches to that session.
 */
export function sendNotification(
  title: string,
  options?: { body?: string; sessionId?: string },
): void {
  if (!isNotificationSupported()) return;
  if (!document.hidden) return;
  if (Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body: options?.body,
    icon: "/favicon.ico",
  });

  if (options?.sessionId) {
    const sessionId = options.sessionId;
    notification.onclick = () => {
      window.focus();
      useStore.getState().setCurrentSession(sessionId);
      notification.close();
    };
  }
}
