import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ironToday } from "../../utils/date";
import WellnessPage from "./WellnessPage";

const { mutateAsync, useWellness } = vi.hoisted(() => ({ mutateAsync: vi.fn(), useWellness: vi.fn() }));
vi.mock("../../hooks/hooks", () => ({ useWellness }));

describe("WellnessPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue(undefined);
    useWellness.mockReturnValue({
      data: [{ date: ironToday(), waterGlasses: 7, movementBreaks: 5 }],
      save: { mutateAsync, isPending: false }, isPending: false,
    });
  });

  it("saves water and movement check-ins at the configured goals", async () => {
    render(<MemoryRouter><WellnessPage onError={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Configure reminders in Settings." })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("heading", { name: "Reminders" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add one glass of water" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one movement break" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenNthCalledWith(1, { date: ironToday(), waterGlasses: 8, movementBreaks: 5 }));
    expect(mutateAsync).toHaveBeenNthCalledWith(2, { date: ironToday(), waterGlasses: 7, movementBreaks: 6 });
    expect(screen.getAllByText("1 to your daily target")).toHaveLength(2);
  });

  it("reports failed wellness saves and keeps decrement controls disabled at zero", async () => {
    const onError = vi.fn();
    useWellness.mockReturnValue({
      data: [{ date: ironToday(), waterGlasses: 0, movementBreaks: 0 }],
      save: { mutateAsync: vi.fn().mockRejectedValue(new Error("Save failed")), isPending: false }, isPending: false,
    });
    render(<MemoryRouter><WellnessPage onError={onError} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Remove one glass of water" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove one movement break" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add one glass of water" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Save failed"));
  });
});
