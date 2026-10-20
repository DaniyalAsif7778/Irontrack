import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScheduleManager from "./ScheduleManager";

const { useCopySchedule, useRoutineSchedule, mutateAsync } = vi.hoisted(() => ({
  useCopySchedule: vi.fn(), useRoutineSchedule: vi.fn(), mutateAsync: vi.fn(),
}));
vi.mock("../../hooks/hooks", () => ({ useCopySchedule, useRoutineSchedule }));

describe("ScheduleManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoutineSchedule.mockImplementation((dayType: string) => ({
      data: { dayType, blocks: [{ id: "fajr", label: "Fajr", tasks: [{ _id: "t1" }] }] }, error: null,
    }));
    useCopySchedule.mockReturnValue({ mutateAsync, isPending: false, variables: undefined });
    mutateAsync.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  });

  it("shows both schedules and confirms before copying a template", async () => {
    render(<ScheduleManager onError={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Schedules" })).toBeInTheDocument();
    expect(screen.getAllByText("1 routine tasks")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Copy to weekend" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ source: "weekday", target: "weekend" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Replace the weekend schedule"));
  });

  it("does not copy when confirmation is declined", () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    render(<ScheduleManager onError={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy to weekend" }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("disables copying an empty schedule and reports schedule loading errors", async () => {
    const onError = vi.fn();
    useRoutineSchedule.mockImplementation((dayType: string) => ({ data: { dayType, blocks: [] }, error: null }));
    render(<ScheduleManager onError={onError} />);
    expect(screen.getByRole("button", { name: "Copy to weekend" })).toBeDisabled();

    useRoutineSchedule.mockImplementation((dayType: string) => ({ data: null, error: dayType === "weekday" ? new Error("Schedule unavailable") : null }));
    render(<ScheduleManager onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Schedule unavailable"));
  });
});
