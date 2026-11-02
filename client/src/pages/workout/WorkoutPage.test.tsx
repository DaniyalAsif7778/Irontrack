import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const library = [{ id: "row", name: "Dumbbell Row", muscle: "Back", cues: ["Keep your back neutral."] }];
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const week = weekdays.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), planId: key === dayKey ? plan.id : null }));

function renderWorkout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><WorkoutPage onError={vi.fn()} /></MemoryRouter></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("WorkoutPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/workout-plans") return [plan];
      if (path === "/exercise-library") return library;
      if (path === "/workout-program" && options?.method === "PUT") {
        const payload = JSON.parse(String(options.body));
        return { days: payload.days, exerciseLibrary: payload.exerciseLibrary, plans: payload.plans.map((item: { id: string; name: string; exercises: { exerciseId: string; sets: number; reps: number; rest: number; tempo: string; setList: unknown[] }[] }) => ({ id: item.id, name: item.name, exercises: item.exercises.map(ref => ({ ...payload.exerciseLibrary.find((definition: { id: string }) => definition.id === ref.exerciseId), ...ref, id: ref.exerciseId })) })) };
      }
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

  it("auto-advances to the next exercise after the rest timer ends", async () => {
    const nextExercise = { ...exercise, id: "press", name: "Dumbbell Press" };
    const multiExercisePlan = { ...plan, exercises: [exercise, nextExercise] };
    const defaultImplementation = api.getMockImplementation();
    api.mockImplementation(async (path: string, options?: RequestInit) => path === "/workout-plans" ? [multiExercisePlan] : defaultImplementation!(path, options));

    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    fireEvent.click(screen.getByRole("button", { name: "Auto Off" }));
    expect(screen.getByRole("button", { name: "Auto On" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 1/i }));

    expect(screen.getByRole("heading", { name: "Dumbbell Row", level: 3 })).toBeInTheDocument();
    expect(await screen.findByText("Next exercise starts after rest")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip timer" }));
    expect(await screen.findByRole("heading", { name: "Dumbbell Press", level: 3 })).toBeInTheDocument();
  });

  it("lets a user skip remaining sets and save only the sets they completed", async () => {
    const twoSetPlan = { ...plan, exercises: [{ ...exercise, sets: 2 }] };
    const defaultImplementation = api.getMockImplementation();
    api.mockImplementation(async (path: string, options?: RequestInit) => path === "/workout-plans" ? [twoSetPlan] : defaultImplementation!(path, options));

    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 2/i }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Exercise" }));
    expect(await screen.findByRole("button", { name: "Resume Dumbbell Row" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Save workout and return/i }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" })));
    const payload = JSON.parse(String(api.mock.calls.find(([path, options]) => path === "/workout-logs" && options?.method === "POST")![1].body));
    expect(payload.exercises).toEqual([{ exerciseId: "row", name: "Dumbbell Row", muscle: "Back", sets: [{ reps: 8, weight: 0 }] }]);
  });

  it("announces the current exercise and speaks the first tempo count", async () => {
    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      constructor(readonly text: string) {}
    }
    const speech = { speak: vi.fn(), cancel: vi.fn() };
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);

    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    fireEvent.click(screen.getByRole("button", { name: "Voice coach off" }));

    await waitFor(() => expect(speech.speak).toHaveBeenCalled());
    const introduction = speech.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(introduction.text).toBe("Dumbbell Row. Set 1.");
    introduction.onend?.();
    expect((speech.speak.mock.calls[1][0] as MockSpeechSynthesisUtterance).text).toBe("lower one");
  });

  it("edits inline and persists the complete workout once from the header", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.click(screen.getByRole("button", { name: `Edit ${dayLabel} workout name` }));
    fireEvent.change(screen.getByLabelText(`${dayLabel} workout name`), { target: { value: "Pull strength" } });
    fireEvent.click(screen.getByRole("button", { name: `Save ${dayLabel} workout name` }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Dumbbell Row target reps" }));
    fireEvent.change(screen.getByLabelText("Dumbbell Row target reps"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Dumbbell Row target reps" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Dumbbell Row name" }));
    fireEvent.change(screen.getByLabelText("Dumbbell Row name"), { target: { value: "Single arm row" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Dumbbell Row name" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-program", expect.objectContaining({ method: "PUT" })));
    const saves = api.mock.calls.filter(([path, options]) => path === "/workout-program" && options?.method === "PUT");
    expect(saves).toHaveLength(1);
    expect(JSON.parse(String(saves[0][1].body))).toMatchObject({
      plans: [{ id: "day-pull", name: "Pull strength", exercises: [{ exerciseId: "row", reps: 10 }] }],
      exerciseLibrary: [{ id: "row", name: "Single arm row" }],
    });
    expect(await screen.findByRole("heading", { name: "Pull strength" })).toBeInTheDocument();
  });

  it("closes a workout-name input when focus moves elsewhere", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.click(screen.getByRole("button", { name: `Edit ${dayLabel} workout name` }));
    const nameInput = screen.getByLabelText(`${dayLabel} workout name`);
    fireEvent.change(nameInput, { target: { value: "Pull focus" } });
    fireEvent.pointerDown(screen.getByRole("button", { name: dayLabel.slice(0, 3) }));
    fireEvent.click(screen.getByRole("button", { name: dayLabel }));

    expect(screen.queryByLabelText(`${dayLabel} workout name`)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Edit ${dayLabel} workout name` })).toBeInTheDocument();
    expect(screen.getAllByText("Pull focus").length).toBeGreaterThan(0);
  });

  it("shows a close control and asks before discarding workout plan changes", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.click(screen.getByRole("button", { name: `Edit ${dayLabel} workout name` }));
    fireEvent.change(screen.getByLabelText(`${dayLabel} workout name`), { target: { value: "Unsaved name" } });
    fireEvent.click(screen.getByRole("button", { name: `Save ${dayLabel} workout name` }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));

    expect(confirm).toHaveBeenCalledWith("Discard your unsaved workout changes?");
    expect(await screen.findByRole("button", { name: "Edit plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pull" })).toBeInTheDocument();
  });

  it("cancels a single inline field without changing its saved draft", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Dumbbell Row target reps" }));
    fireEvent.change(screen.getByLabelText("Dumbbell Row target reps"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel editing Dumbbell Row target reps" }));

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.queryByLabelText("Dumbbell Row target reps")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("keeps the set rows aligned with the edited target set count", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Dumbbell Row sets" }));
    fireEvent.change(screen.getByLabelText("Dumbbell Row sets"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Dumbbell Row sets" }));

    expect(screen.getByRole("button", { name: "Edit Dumbbell Row set 3 reps" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-program", expect.objectContaining({ method: "PUT" })));
    const save = api.mock.calls.find(([path, options]) => path === "/workout-program" && options?.method === "PUT")!;
    expect(JSON.parse(String(save[1].body)).plans[0].exercises[0]).toMatchObject({
      sets: 3,
      setList: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }, { reps: 8, weight: 0 }],
    });
  });

  it("assigns an existing workout with buttons and saves it with the same draft", async () => {
    const restKey = weekdays.find(key => key !== dayKey)!;
    const restLabel = `${restKey[0].toUpperCase()}${restKey.slice(1)}`;
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    const restDay = screen.getByRole("button", { name: restLabel.slice(0, 3) }).parentElement!;
    fireEvent.click(within(restDay).getByRole("button", { name: /Assign workout/ }));

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pull" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-program", expect.objectContaining({ method: "PUT" })));
    const save = api.mock.calls.find(([path, options]) => path === "/workout-program" && options?.method === "PUT")!;
    expect(JSON.parse(String(save[1].body)).days.find((day: { key: string }) => day.key === restKey)).toMatchObject({ label: restLabel, planId: "day-pull" });
  });

  it("starts without preset workouts and creates a day inside the single-save editing flow", async () => {
    api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/workout-plans") return [];
      if (path === "/exercise-library") return [];
      if (path === "/workout-program" && options?.method === "PUT") return JSON.parse(String(options.body));
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
    expect(await screen.findByLabelText(`${dayLabel} workout name`)).toHaveValue("New workout");
    fireEvent.change(screen.getByLabelText(`${dayLabel} workout name`), { target: { value: "Upper strength" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-program", expect.objectContaining({ method: "PUT" })));
  });
});
