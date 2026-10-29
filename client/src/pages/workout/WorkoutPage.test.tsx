import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutPage from "./WorkoutPage";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../../lib/api/api", () => ({ api }));

const exercise = {
  id: "row", name: "Dumbbell Row", muscle: "Back", sets: 1, reps: 8,
  tempo: "3-1-2", rest: 0, cues: ["Keep your back neutral."],
};
const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
const dayLabel = dayKey[0].toUpperCase() + dayKey.slice(1);
const plan = { id: "day-pull", name: "Pull", exercises: [exercise] };
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const week = weekdays.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), planId: key === dayKey ? plan.id : null }));

function renderWorkout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><WorkoutPage onError={vi.fn()} /></MemoryRouter></QueryClientProvider>);
}

describe("WorkoutPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/workout-plans") return [plan];
      if (path === "/workout-week" && options?.method === "PUT") return JSON.parse(String(options.body)).days;
      if (path === "/workout-week") return week;
      if (path.startsWith("/workout-logs")) return [];
      if (path === "/workout-plans/day-pull" && options?.method === "PUT") return { ...plan, ...JSON.parse(String(options.body)) };
      if (path === "/workout-logs" && options?.method === "POST") return { _id: "log-1" };
      throw new Error(`Unexpected API call: ${path}`);
    });
  });

  it("starts, pauses, resumes, and safely discards an unfinished session", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));

    expect(await screen.findByRole("heading", { name: "Pull" })).toBeInTheDocument();
    expect(localStorage.getItem("irontrack_active_workout_v1")).toContain('"dayType":"day-pull"');
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Done — Set 1 of 1/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "End" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("discard its uncompleted session"));
    await waitFor(() => expect(localStorage.getItem("irontrack_active_workout_v1")).toBeNull());
    expect(screen.getByRole("button", { name: "Start workout" })).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" }));
  });

  it("saves a finished workout with only completed set details", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    fireEvent.change(screen.getByLabelText("Dumbbell Row set 1 weight"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 1/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Save workout and return/i }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" })));
    const payload = JSON.parse(api.mock.calls.find(([path, options]) => path === "/workout-logs" && options?.method === "POST")![1].body as string);
    expect(payload).toMatchObject({ dayType: "day-pull", dayName: "Pull", exercises: [{ exerciseId: "row", sets: [{ reps: 8, weight: 20 }] }] });
    await waitFor(() => expect(localStorage.getItem("irontrack_active_workout_v1")).toBeNull());
  });

  it("adds an exercise with every form field and saves the complete plan", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Edit plan" }));
    fireEvent.click(screen.getByRole("button", { name: /Add exercise/i }));

    expect(screen.getByRole("heading", { name: "Add exercise" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Incline Row" } });
    fireEvent.change(screen.getByLabelText("Muscle group"), { target: { value: "Upper back" } });
    fireEvent.change(screen.getByLabelText("Sets"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Rest seconds"), { target: { value: "75" } });
    fireEvent.change(screen.getByLabelText("Tempo"), { target: { value: "4-1-2" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Controlled pull." } });
    fireEvent.change(screen.getByLabelText("Set targets"), { target: { value: "8, 12.5\n6, 15" } });
    fireEvent.change(screen.getByLabelText("Step-by-step instructions"), { target: { value: "Brace\nPull\nLower" } });
    fireEvent.change(screen.getByLabelText("Form cues"), { target: { value: "Stay stable\nControl the negative" } });
    fireEvent.change(screen.getByLabelText("Demo video URL"), { target: { value: "https://example.com/demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-plans/day-pull", expect.objectContaining({ method: "PUT" })));
    const saved = JSON.parse(api.mock.calls.find(([path, options]) => path === "/workout-plans/day-pull" && options?.method === "PUT")![1].body as string);
    expect(saved.exercises.at(-1)).toMatchObject({
      name: "Incline Row", muscle: "Upper back", sets: 2, reps: 8, rest: 75, tempo: "4-1-2",
      description: "Controlled pull.", setList: [{ reps: 8, weight: 12.5 }, { reps: 6, weight: 15 }],
      steps: ["Brace", "Pull", "Lower"], cues: ["Stay stable", "Control the negative"], videoUrl: "https://example.com/demo",
    });
  });

  it("starts with no preset workouts and lets the user create a named workout day", async () => {
    api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/workout-plans") return [];
      if (path === "/workout-week" && options?.method === "PUT") return JSON.parse(String(options.body)).days;
      if (path === "/workout-week") return weekdays.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), planId: null }));
      if (path.startsWith("/workout-logs")) return [];
      if (path.startsWith("/workout-plans/") && options?.method === "PUT") return { id: path.split("/").at(-1), ...JSON.parse(String(options.body)) };
      throw new Error(`Unexpected API call: ${path}`);
    });
    renderWorkout();
    expect(await screen.findByRole("heading", { name: "Start with your own workout" })).toBeInTheDocument();
    expect(screen.queryByText(/Push · high rep|Pull · high rep/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create your first workout day" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Upper body strength"), { target: { value: "Upper strength" } });
    fireEvent.click(screen.getByRole("button", { name: "Create workout day" }));
    expect(await screen.findByLabelText("Workout day name")).toHaveValue("Upper strength");
    expect(api).toHaveBeenCalledWith("/workout-week", expect.objectContaining({ method: "PUT" }));
  });
});
