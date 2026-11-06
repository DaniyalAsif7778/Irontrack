import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./SettingsPage";
import { useAppStore } from "../../stores/appStore";
import { api } from "../../lib/api/api";
import type { AuthUser } from "../../types";

vi.mock("../../lib/api/api", () => ({ api: vi.fn() }));

const user: AuthUser = {
  id: "account-123",
  name: "Daniyal",
  email: "daniyal@example.com",
  preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } },
};

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api).mockResolvedValue({ sessions: [] } as never);
    useAppStore.getState().setPreferences({ weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } });
  });

  it("saves local demo preferences and exposes the settings controls", async () => {
    const queryClient = new QueryClient();
    render(<QueryClientProvider client={queryClient}><SettingsPage user={null} onError={vi.fn()} /></QueryClientProvider>);

    fireEvent.change(screen.getByLabelText(/default weight unit/i), { target: { value: "lb" } });
    fireEvent.change(screen.getByLabelText(/focus session/i), { target: { value: "55" } });
    fireEvent.change(screen.getByLabelText(/break \(minutes\)/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Dhuhr"), { target: { value: "12:30" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(useAppStore.getState().preferences).toEqual({ weightUnit: "lb", focusMinutes: 55, breakMinutes: 10, prayerTimes: { fajr: "", dhuhr: "12:30", asr: "", maghrib: "", isha: "" } }));
    expect(screen.getByText(/sign in to manage your profile/i)).toBeInTheDocument();
  });

  it("explains the account deletion requirements without sending an incomplete request", async () => {
    const queryClient = new QueryClient();
    render(<QueryClientProvider client={queryClient}><SettingsPage user={user} onError={vi.fn()} /></QueryClientProvider>);

    const deleteButton = screen.getByRole("button", { name: /permanently delete account/i });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your current password/i);
    expect(api).not.toHaveBeenCalledWith("/auth/me", expect.objectContaining({ method: "DELETE" }));

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: "no" } });
    fireEvent.click(deleteButton);
    expect(await screen.findByRole("alert")).toHaveTextContent(/type DELETE to confirm/i);
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: " delete " } });
    fireEvent.click(deleteButton);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ password: "correct-password", confirmation: "DELETE" }),
    }));
  });

  it("keeps local state and the session when account deletion fails", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "me"], user);
    vi.mocked(api).mockImplementation(async path => {
      if (path === "/auth/sessions") return { sessions: [] } as never;
      throw new Error("The current password is incorrect");
    });
    render(<QueryClientProvider client={queryClient}><SettingsPage user={user} onError={vi.fn()} /></QueryClientProvider>);

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "wrong-password" } });
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The current password is incorrect");
    expect(queryClient.getQueryData(["auth", "me"])).toEqual(user);
  });

  it("clears account-scoped browser data and session cache after server deletion", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "me"], user);
    localStorage.setItem("irontrack_sync_queue_v1_account-123", "[]");
    localStorage.setItem("irontrack_active_workout_v1", "{}");
    localStorage.setItem("irontrack_task_timer:account-123", "{}");
    localStorage.setItem("irontrack_settings", "{}");
    render(<QueryClientProvider client={queryClient}><SettingsPage user={user} onError={vi.fn()} /></QueryClientProvider>);

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

    await waitFor(() => expect(queryClient.getQueryData(["auth", "me"])).toBeNull());
    expect(api).toHaveBeenCalledWith("/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ password: "correct-password", confirmation: "DELETE" }),
    });
    expect(localStorage.getItem("irontrack_sync_queue_v1_account-123")).toBeNull();
    expect(localStorage.getItem("irontrack_active_workout_v1")).toBeNull();
    expect(localStorage.getItem("irontrack_task_timer:account-123")).toBeNull();
    expect(localStorage.getItem("irontrack_settings")).toBeNull();
  });
});
