import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => api.mockReset());
  it("provides a useful first-workout state when history is empty", async () => {
    api.mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false });
    renderStats();
    expect(await screen.findByRole("heading", { name: "Your stats start with your first session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a workout" })).toBeInTheDocument();
  });

  it("switches across all statistics views and opens an exercise record", async () => {
    api.mockResolvedValueOnce({ items: [{
      _id: "log-1", date: "2026-10-20", dayType: "pull", totalSets: 2, totalVolume: 900, duration: 1800,
      exercises: [{ exerciseId: "row-1", name: "Dumbbell Row", muscle: "Back", sets: [{ reps: 10, weight: 30 }, { reps: 8, weight: 35 }] }],
    }], nextCursor: null, hasMore: false });
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

  it("loads older workout history using the next cursor", async () => {
    api.mockResolvedValueOnce({ items: [{ _id: "log-new", date: "2026-11-03", dayType: "pull", totalSets: 1, totalVolume: 100, duration: 600, exercises: [] }], nextCursor: "cursor-one", hasMore: true });
    api.mockResolvedValueOnce({ items: [{ _id: "log-old", date: "2026-10-01", dayType: "push", totalSets: 1, totalVolume: 80, duration: 500, exercises: [] }], nextCursor: null, hasMore: false });
    renderStats();

    fireEvent.click(await screen.findByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "Load older sessions" }));
    await waitFor(() => expect(screen.getByText("Session history")).toBeInTheDocument());
    expect(api).toHaveBeenNthCalledWith(2, "/workout-logs?limit=200&cursor=cursor-one");
    expect(screen.getByText(/1 Oct|Oct 1/)).toBeInTheDocument();
  });
});
