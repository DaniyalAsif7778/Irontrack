import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./AnalyticsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";

vi.mock("../../lib/api/api", () => ({ api: vi.fn(async (path: string) => path.includes("routine/events") ? { counts: {} } : []) }));

function renderPage(data: ComponentProps<typeof AnalyticsPage>["data"], onRange: (days: number) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><AnalyticsPage data={data} onRange={onRange} /></MemoryRouter></QueryClientProvider>);
}

describe("AnalyticsPage", () => {
  it("shows empty states and forwards selected time ranges", () => {
    const onRange = vi.fn();
    renderPage(null, onRange);

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByText("No routine activity in this period.")).toBeInTheDocument();
    expect(screen.getByText("No weight logs in this period.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "30D" }));
    expect(onRange).toHaveBeenCalledWith(30);
  });

  it("renders completion metrics and highlights the selected range", () => {
    renderPage({
      days: 14, totalCompleted: 31, periodCompleted: 8,
      activity: [{ date: "2026-10-20", completed: 2, total: 4, rate: 50 }],
      weightTrend: {
        entries: [{ date: "2026-10-20", weight: 81.2, unit: "kg" }],
        latest: { date: "2026-10-20", weight: 81.2, unit: "kg" }, change: -0.4,
      },
    }, vi.fn());

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("-0.4 kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "14D" })).toHaveClass("selected");
  });
});
