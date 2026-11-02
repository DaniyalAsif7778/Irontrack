import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./AnalyticsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { api } from "../../lib/api/api";

vi.mock("../../lib/api/api", () => ({ api: vi.fn(async (path: string) => path.includes("routine/events") ? { counts: {} } : []) }));

function renderPage(data: ComponentProps<typeof AnalyticsPage>["data"], onRange: ComponentProps<typeof AnalyticsPage>["onRange"], accountId = "account-a", period: ComponentProps<typeof AnalyticsPage>["period"] = "7d") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><AnalyticsPage data={data} accountId={accountId} onRange={onRange} period={period} /></MemoryRouter></QueryClientProvider>);
}

describe("AnalyticsPage", () => {
  it("shows empty states and forwards selected time ranges", () => {
    const onRange = vi.fn();
    renderPage(null, onRange);

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByText("No routine activity in this period.")).toBeInTheDocument();
    expect(screen.getByText("No weight logs in this period.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Analytics period" }), { target: { value: "30d" } });
    expect(onRange).toHaveBeenCalledWith("30d");
  });

  it("renders completion metrics and highlights the selected range", () => {
    renderPage({
      period: "30d", periodLabel: "Last 30 days", startDate: "2026-09-21", endDate: "2026-10-20", granularity: "day", days: 30, totalCompleted: 31, periodCompleted: 8,
      activity: [{ date: "2026-10-20", completed: 2, total: 4, rate: 50 }],
      weightTrend: {
        entries: [{ date: "2026-10-20", weight: 81.2, unit: "kg" }],
        latest: { date: "2026-10-20", weight: 81.2, unit: "kg" }, change: -0.4,
      },
    }, vi.fn(), "account-a", "30d");

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("-0.4 kg")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Analytics period" })).toHaveValue("30d");
    expect(screen.getByRole("img", { name: /showing 2 completed routine tasks across 1 day/i })).toBeInTheDocument();
    expect(screen.getByText("View daily completion data")).toBeInTheDocument();
    expect(screen.getByText("View weight entries")).toBeInTheDocument();
  });

  it("keeps weekly focus preferences separate between accounts", () => {
    localStorage.setItem("irontrack_weekly_focus_v1:account-a", "Plan fewer training days");
    renderPage(null, vi.fn(), "account-b");

    expect(screen.getByRole("button", { name: "Plan fewer training days" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/saves your selection on this account/i)).toBeInTheDocument();
  });

  it("shows a retry action when weekly data fails to load", async () => {
    let failedOnce = false;
    vi.mocked(api).mockImplementation(async path => {
      if (path.startsWith("/workout-logs") && !failedOnce) {
        failedOnce = true;
        throw new Error("Network unavailable");
      }
      return path.includes("routine/events") ? { counts: {} } as never : [] as never;
    });
    renderPage(null, vi.fn());

    expect(await screen.findByRole("alert")).toHaveTextContent("Some weekly data could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Updated"));
    expect(screen.getByText("Workouts logged").previousElementSibling).toHaveTextContent("0");
  });
});
