import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoutinePage from "./RoutinePage";

vi.mock("../../hooks/useAnalytics", () => ({ useAnalytics: () => ({ data: { activity: [] }, error: null }) }));

describe("RoutinePage empty routine state", () => {
  const edit = vi.fn();
  const props = {
    date: "2026-10-20", title: "Tuesday, Oct 20", day: null, dayType: "weekday" as const,
    dayLoading: true, dayError: null, setDate: vi.fn(), complete: vi.fn(), edit, remove: vi.fn(),
    saveSubtasks: vi.fn(), onError: vi.fn(), startTask: vi.fn(), queueTask: vi.fn(), extendTask: vi.fn(), snoozeTask: vi.fn(), eventStats: undefined,
  };

  beforeEach(() => edit.mockClear());

  it("shows all five prayer anchors while data is loading and offers a first task", () => {
    render(<RoutinePage {...props} />);
    for (const prayer of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      expect(screen.getByRole("heading", { name: prayer })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: /add your first task/i }));
    expect(edit).toHaveBeenCalledWith({ block: "fajr" });
    expect(screen.getByRole("status")).toHaveTextContent(/five prayer blocks are ready/i);
  });

  it("shows the prayer anchors and a recovery message when loading fails", () => {
    render(<RoutinePage {...props} dayLoading={false} dayError="Network unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Network unavailable/);
    expect(screen.getAllByRole("heading").map(heading => heading.textContent?.trim())).toEqual(expect.arrayContaining(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]));
  });
});
