import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ironToday } from "../../utils/date";
import WellnessPage, { defaultReminderPreferences, reminderStorageKey } from "./WellnessPage";

const { api, mutateAsync, useWellness } = vi.hoisted(() => ({ api: vi.fn(), mutateAsync: vi.fn(), useWellness: vi.fn() }));
vi.mock("../../lib/api/api", () => ({ api }));
vi.mock("../../hooks/hooks", () => ({ useWellness }));

describe("WellnessPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue(undefined);
    api.mockImplementation(async path => path === "/notifications/config"
      ? { enabled: false, publicKey: null }
      : { configured: false, subscribed: false, preferences: null });
    useWellness.mockReturnValue({
      data: [{ date: ironToday(), waterGlasses: 7, movementBreaks: 5 }],
      save: { mutateAsync, isPending: false }, isPending: false,
    });
  });

  it("saves water and movement check-ins at the configured goals", async () => {
    render(<WellnessPage onError={vi.fn()} />);
    await screen.findByText("Waiting for server VAPID configuration");
    fireEvent.click(screen.getByRole("button", { name: "Add one glass of water" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one movement break" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenNthCalledWith(1, { date: ironToday(), waterGlasses: 8, movementBreaks: 5 }));
    expect(mutateAsync).toHaveBeenNthCalledWith(2, { date: ironToday(), waterGlasses: 7, movementBreaks: 6 });
    expect(screen.getAllByText("1 to your daily target")).toHaveLength(2);
  });

  it("persists reminder preferences locally without requiring push configuration", async () => {
    render(<WellnessPage onError={vi.fn()} />);
    await screen.findByText("Waiting for server VAPID configuration");
    fireEvent.click(screen.getByRole("checkbox", { name: /Water check-in/ }));

    expect(JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}"))
      .toEqual({ ...defaultReminderPreferences, hydration: true });
    expect(api).not.toHaveBeenCalledWith("/notifications/preferences", expect.anything());
  });

  it("reports failed wellness saves and keeps decrement controls disabled at zero", async () => {
    const onError = vi.fn();
    useWellness.mockReturnValue({
      data: [{ date: ironToday(), waterGlasses: 0, movementBreaks: 0 }],
      save: { mutateAsync: vi.fn().mockRejectedValue(new Error("Save failed")), isPending: false }, isPending: false,
    });
    render(<WellnessPage onError={onError} />);
    await screen.findByText("Waiting for server VAPID configuration");

    expect(screen.getByRole("button", { name: "Remove one glass of water" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove one movement break" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add one glass of water" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Save failed"));
  });
});
