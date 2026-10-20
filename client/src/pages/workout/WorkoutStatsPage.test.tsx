import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import WorkoutStatsPage from "./WorkoutStatsPage";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../../lib/api/api", () => ({ api }));
vi.mock("recharts", () => ({
  Bar: () => null, BarChart: () => null, CartesianGrid: () => null, Cell: () => null,
  Line: () => null, LineChart: () => null, Pie: () => null, PieChart: () => null,
  ResponsiveContainer: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function renderStats() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><WorkoutStatsPage onError={vi.fn()} /><LocationProbe /></MemoryRouter></QueryClientProvider>);
}

describe("WorkoutStatsPage", () => {
  it("provides a useful first-workout state when history is empty", async () => {
    api.mockResolvedValueOnce([]);
    renderStats();
    expect(await screen.findByRole("heading", { name: "Your stats start with your first session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a workout" })).toBeInTheDocument();
  });

  it("switches across all statistics views and opens an exercise record", async () => {
    api.mockResolvedValueOnce([{
      _id: "log-1", date: "2026-10-20", dayType: "pull", totalSets: 2, totalVolume: 900, duration: 1800,
      exercises: [{ exerciseId: "row-1", name: "Dumbbell Row", muscle: "Back", sets: [{ reps: 10, weight: 30 }, { reps: 8, weight: 35 }] }],
    }]);
    renderStats();

    expect(await screen.findByText("Dumbbell Row")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("12-week activity")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volume" }));
    expect(screen.getByText("Volume per session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Session history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PRs" }));
    expect(screen.getByText("Personal records")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dumbbell Row/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/exercise/row-1");
  });
});
