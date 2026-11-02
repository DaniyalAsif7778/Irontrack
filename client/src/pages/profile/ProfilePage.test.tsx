import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";

describe("ProfilePage", () => {
  it("provides one place for wellness, settings, weight, and schedules", () => {
    const onNavigate = vi.fn();
    render(<ProfilePage user={null} onNavigate={onNavigate} onSignOut={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /wellness & reminders/i }));
    expect(onNavigate).toHaveBeenCalledWith("wellness");
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(onNavigate).toHaveBeenCalledWith("settings");
    fireEvent.click(screen.getByRole("button", { name: /body weight/i }));
    expect(onNavigate).toHaveBeenCalledWith("weight");
    fireEvent.click(screen.getByRole("button", { name: /schedules/i }));
    expect(onNavigate).toHaveBeenCalledWith("schedules");
    expect(screen.getByText("Local demo")).toBeInTheDocument();
  });

  it("offers sign out for an account", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(<ProfilePage user={{ id: "user-1", name: "Sam", email: "sam@example.com", preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } } }} onNavigate={vi.fn()} onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
