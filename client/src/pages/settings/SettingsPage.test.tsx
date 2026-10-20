import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import SettingsPage from "./SettingsPage";
import { useAppStore } from "../../stores/appStore";

describe("SettingsPage", () => {
  beforeEach(() => useAppStore.getState().setPreferences({ weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } }));

  it("saves local demo preferences and exposes the settings controls", async () => {
    const queryClient = new QueryClient();
    render(<QueryClientProvider client={queryClient}><SettingsPage user={null} /></QueryClientProvider>);

    fireEvent.change(screen.getByLabelText(/default weight unit/i), { target: { value: "lb" } });
    fireEvent.change(screen.getByLabelText(/focus session/i), { target: { value: "55" } });
    fireEvent.change(screen.getByLabelText(/break \(minutes\)/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Dhuhr"), { target: { value: "12:30" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(useAppStore.getState().preferences).toEqual({ weightUnit: "lb", focusMinutes: 55, breakMinutes: 10, prayerTimes: { fajr: "", dhuhr: "12:30", asr: "", maghrib: "", isha: "" } }));
    expect(screen.getByText(/local demo/i)).toBeInTheDocument();
  });
});
