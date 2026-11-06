import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReminderSettings from "./ReminderSettings";
import { api } from "../../lib/api/api";
import { defaultReminderPreferences, pushSubscribedKey, reminderStorageKey } from "../../lib/reminderPreferences";
import type { AuthUser } from "../../types";

vi.mock("../../lib/api/api", () => ({ api: vi.fn() }));

const user: AuthUser = {
  id: "account-123",
  name: "Daniyal",
  email: "daniyal@example.com",
  preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } },
};

describe("ReminderSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("keeps reminder choices and sound settings together in Settings", async () => {
    render(<ReminderSettings user={null} onError={vi.fn()} />);
    expect(await screen.findByText("Background delivery is unavailable until the server is configured")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Water check-in/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Notification sound/ }));

    expect(JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}"))
      .toEqual({ ...defaultReminderPreferences, hydration: true });
    expect(localStorage.getItem("irontrack_notification_sound_v1")).toBe("false");
    expect(api).not.toHaveBeenCalled();
  });

  it("loads server reminder preferences and syncs changes for a subscribed device", async () => {
    const subscription = { endpoint: "https://push.example/subscription" };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) },
    });
    vi.mocked(api).mockImplementation(async path => {
      if (path === "/notifications/config") return { enabled: true, publicKey: "public-key" } as never;
      if (path === "/notifications/status?endpoint=https%3A%2F%2Fpush.example%2Fsubscription") {
        return { configured: true, subscribed: true, preferences: { ...defaultReminderPreferences, hydration: true } } as never;
      }
      return {} as never;
    });

    render(<ReminderSettings user={user} onError={vi.fn()} />);
    const hydration = await screen.findByRole("checkbox", { name: /Water check-in/ });
    expect(hydration).toBeChecked();
    expect(screen.getByText("This device is connected to the server")).toBeInTheDocument();

    fireEvent.click(hydration);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/notifications/preferences", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining('"hydration":false'),
    })));
  });

  it("shows the server error when a confirmed server push test fails", async () => {
    const onError = vi.fn();
    const subscription = { endpoint: "https://push.example/subscription" };
    localStorage.setItem(pushSubscribedKey, "true");
    localStorage.setItem("irontrack_notifications_enabled_v1", "true");
    vi.stubGlobal("Notification", { permission: "granted" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) },
    });
    vi.mocked(api).mockImplementation(async path => {
      if (path === "/notifications/config") return { enabled: true, publicKey: "public-key" } as never;
      if (path === "/notifications/status?endpoint=https%3A%2F%2Fpush.example%2Fsubscription") {
        return { configured: true, subscribed: true, preferences: null } as never;
      }
      if (path === "/notifications/test") throw new Error("The notification subscription has expired.");
      return {} as never;
    });

    render(<ReminderSettings user={user} onError={onError} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send server test" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("The notification subscription has expired."));
  });
});
