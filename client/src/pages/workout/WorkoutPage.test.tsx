import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutPage from "./WorkoutPage";
import { useAppStore } from "../../stores/appStore";
import { ironToday } from "../../utils/date";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../../lib/api/api", () => ({ api }));

const exercise = {
  id: "row", name: "Dumbbell Row", muscle: "Back", sets: 1, reps: 8,
  tempo: "3-1-2", rest: 0, cues: ["Keep your back neutral."],
};
const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${ironToday()}T12:00:00`).getDay()];
const dayLabel = dayKey[0].toUpperCase() + dayKey.slice(1);
const plan = { id: "day-pull", name: "Pull", exercises: [exercise] };
const library = [{ id: "row", name: "Dumbbell Row", muscle: "Back", cues: ["Keep your back neutral."] }];
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const week = weekdays.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), planId: key === dayKey ? plan.id : null }));

function renderWorkout(accountId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><WorkoutPage onError={vi.fn()} accountId={accountId} /></MemoryRouter></QueryClientProvider>);
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("WorkoutPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().setPreferences({ ...useAppStore.getState().preferences, weightUnit: "kg" });
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/workout-plans") return [plan];
      if (path === "/exercise-library") return library;
      if (path === "/workout-program" && options?.method === "PUT") {
        const payload = JSON.parse(String(options.body));
        return { days: payload.days, exerciseLibrary: payload.exerciseLibrary, plans: payload.plans.map((item: { id: string; name: string; exercises: { exerciseId: string; sets: number; reps: number; rest: number; tempo: string; setList: unknown[] }[] }) => ({ id: item.id, name: item.name, exercises: item.exercises.map(ref => ({ ...payload.exerciseLibrary.find((definition: { id: string }) => definition.id === ref.exerciseId), ...ref, id: ref.exerciseId })) })) };
      }
      if (/^\/workout-plans\/[^/]+\/exercises\/[^/]+$/.test(path) && options?.method === "PUT") return JSON.parse(String(options.body));
      if (path === "/workout-week" && options?.method === "PUT") return JSON.parse(String(options.body)).days;
      if (path === "/workout-week") return week;
      if (path.startsWith("/workout-logs")) return { items: [], nextCursor: null, hasMore: false };
      if (path === "/workout-plans/day-pull" && options?.method === "PUT") return { ...plan, ...JSON.parse(String(options.body)) };
      if (path === "/workout-logs" && options?.method === "POST") return { _id: "log-1" };
      throw new Error(`Unexpected API call: ${path}`);
    });
  });

  it("keeps active workout data isolated between signed-in accounts", async () => {
    const first = renderWorkout("account-one");
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    await waitFor(() => expect(localStorage.getItem("irontrack_active_workout_v1:account-one")).toContain('"dayType":"day-pull"'));
    first.unmount();

    renderWorkout("account-two");
    await screen.findByRole("button", { name: "Start workout" });
    expect(screen.queryByRole("button", { name: "End workout" })).not.toBeInTheDocument();
    expect(localStorage.getItem("irontrack_active_workout_v1:account-two")).toBeNull();
  });

  it("lets a user finish after skipping every exercise", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Exercise" }));
    expect(await screen.findByRole("heading", { name: "Workout Complete!" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return without saving" }));
    await waitFor(() => expect(localStorage.getItem("irontrack_active_workout_v1:local")).toBeNull());
    expect(api).not.toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" }));
  });

  it("starts, pauses, resumes, and safely discards an unfinished session", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));

    expect(await screen.findByRole("heading", { name: "Pull" })).toBeInTheDocument();
    expect(localStorage.getItem("irontrack_active_workout_v1:local")).toContain('"dayType":"day-pull"');
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Done — Set 1 of 1/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "End" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("discard its uncompleted session"));
    await waitFor(() => expect(localStorage.getItem("irontrack_active_workout_v1:local")).toBeNull());
    expect(screen.getByRole("button", { name: "Start workout" })).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" }));
  });

  it("saves a finished workout with only completed set details", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    fireEvent.change(screen.getByLabelText("Dumbbell Row set 1 weight (kg)"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 1/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Save workout and return/i }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" })));
    const payload = JSON.parse(api.mock.calls.find(([path, options]) => path === "/workout-logs" && options?.method === "POST")![1].body as string);
    expect(payload).toMatchObject({ dayType: "day-pull", dayName: "Pull", exercises: [{ exerciseId: "row", sets: [{ reps: 8, weight: 20 }] }] });
    await waitFor(() => expect(localStorage.getItem("irontrack_active_workout_v1:local")).toBeNull());
  });

  it("shows the selected unit while saving workout weights in kilograms", async () => {
    useAppStore.getState().setPreferences({ ...useAppStore.getState().preferences, weightUnit: "lb" });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    const load = screen.getByLabelText("Dumbbell Row set 1 weight (lb)");
    fireEvent.change(load, { target: { value: "44.1" } });
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 1/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Save workout and return/i }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" })));
    const payload = JSON.parse(api.mock.calls.find(([path, options]) => path === "/workout-logs" && options?.method === "POST")![1].body as string);
    expect(payload.exercises[0].sets[0].weight).toBeCloseTo(20, 1);
  });

  it("lets a user replace a live set rep value with 3 or 4", async () => {
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    const reps = screen.getByLabelText("Dumbbell Row set 1 reps");
    fireEvent.change(reps, { target: { value: "" } });
    expect(reps).toHaveValue(null);
    fireEvent.change(reps, { target: { value: "4" } });
    expect(reps).toHaveValue(4);
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 1/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Save workout and return/i }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-logs", expect.objectContaining({ method: "POST" })));
    const payload = JSON.parse(String(api.mock.calls.find(([path, options]) => path === "/workout-logs" && options?.method === "POST")![1].body));
    expect(payload.exercises[0].sets[0].reps).toBe(4);
  });

  it("auto-advances to the next exercise after the rest timer ends", async () => {
    const nextExercise = { ...exercise, id: "press", name: "Dumbbell Press" };
    const multiExercisePlan = { ...plan, exercises: [{ ...exercise, rest: 2 }, nextExercise] };
    const defaultImplementation = api.getMockImplementation();
    api.mockImplementation(async (path: string, options?: RequestInit) => path === "/workout-plans" ? [multiExercisePlan] : defaultImplementation!(path, options));

    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start workout" }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Auto coach off" }));
    expect(screen.getByRole("button", { name: "Auto coach on" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Done — Set 1 of 1/i }));

    expect(screen.getByRole("heading", { name: "Dumbbell Row", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Next exercise starts after rest")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(screen.getByRole("heading", { name: "Dumbbell Press", level: 3 })).toBeInTheDocument();
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

  it("speaks the set naturally and counts each configured tempo phase", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Auto coach off" }));

    await waitFor(() => expect(speech.speak).toHaveBeenCalled());
    const cue = speech.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(cue.text).toBe("Dumbbell Row. Set one.");
    expect(cue.rate).toBe(0.95);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Auto coach on" })).toHaveAttribute("aria-pressed", "true");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start tempo count" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(speech.speak.mock.calls.slice(1).map(([utterance]) => (utterance as MockSpeechSynthesisUtterance).text)).toEqual(["Lower, one", "two", "three", "Hold, one", "Lift, one", "two"]);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(speech.cancel).toHaveBeenCalled();
  });

  it("saves an edited exercise through its own request without saving the whole program", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    const dayStrip = screen.getByRole("group", { name: "Workout days" });
    expect(dayStrip).toHaveClass("week-strip-editing");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Exercise name"), { target: { value: "Single arm row" } });
    fireEvent.change(screen.getByLabelText("Target reps"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-plans/day-pull/exercises/row", expect.objectContaining({ method: "PUT" })));
    const exerciseSave = api.mock.calls.find(([path, options]) => path === "/workout-plans/day-pull/exercises/row" && options?.method === "PUT")!;
    expect(JSON.parse(String(exerciseSave[1].body))).toMatchObject({ id: "row", name: "Single arm row", reps: 10, sets: 1, tempo: "3-1-2" });
    expect(api).not.toHaveBeenCalledWith("/workout-program", expect.anything());
    expect(await screen.findByRole("heading", { name: "Single arm row", level: 3 })).toBeInTheDocument();
  });

  it("allows clearing reps before entering a small value and saves selected tempo seconds", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const targetReps = screen.getByLabelText("Target reps");
    fireEvent.change(targetReps, { target: { value: "1" } });
    fireEvent.change(targetReps, { target: { value: "" } });
    expect(targetReps).toHaveValue(null);
    fireEvent.change(targetReps, { target: { value: "4" } });
    const setReps = screen.getByLabelText("Set 1 reps");
    fireEvent.change(setReps, { target: { value: "" } });
    fireEvent.change(setReps, { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Lower tempo seconds"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Hold tempo seconds"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Lift tempo seconds"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-plans/day-pull/exercises/row", expect.objectContaining({ method: "PUT" })));
    const saved = api.mock.calls.find(([path, options]) => path === "/workout-plans/day-pull/exercises/row" && options?.method === "PUT")!;
    expect(JSON.parse(String(saved[1].body))).toMatchObject({ reps: 4, tempo: "4-2-3", setList: [{ reps: 4, weight: 0 }] });
  });

  it("creates and saves a workout name from the workout picker", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    fireEvent.click(screen.getByRole("button", { name: `Change workout for ${dayLabel}` }));
    fireEvent.click(screen.getByRole("button", { name: "＋ New workout" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New workout name" }), { target: { value: "Back day" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & use" }));
    expect(screen.queryByRole("textbox", { name: "New workout name" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Back day" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`irontrack_workout_name_suggestions_v1:local`) ?? "[]")).toContain("Back day");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-program", expect.objectContaining({ method: "PUT" })));
    const saved = api.mock.calls.find(([path, options]) => path === "/workout-program" && options?.method === "PUT");
    const renamedPlan = JSON.parse(String(saved?.[1].body)).plans.find((item: { name: string }) => item.name === "Back day");
    expect(renamedPlan.exercises).toHaveLength(1);
    expect(renamedPlan.exercises[0].exerciseId).toBe("row");
  });

  it("saves a typed workout name locally when the user clicks outside the picker", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    fireEvent.click(screen.getByRole("button", { name: `Change workout for ${dayLabel}` }));
    fireEvent.click(screen.getByRole("button", { name: "＋ New workout" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New workout name" }), { target: { value: "Pull focus" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "New workout name" }), { relatedTarget: document.body });

    expect(screen.queryByLabelText("New workout name")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("irontrack_workout_name_suggestions_v1:local") ?? "[]")).toContain("Pull focus");
  });

  it("shows a close control and asks before discarding workout plan changes", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    fireEvent.click(screen.getByRole("button", { name: `Change workout for ${dayLabel}` }));
    fireEvent.click(screen.getByRole("button", { name: "＋ New workout" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New workout name" }), { target: { value: "Unsaved name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & use" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));

    expect(confirm).toHaveBeenCalledWith("Discard your unsaved workout changes?");
    expect(await screen.findByRole("button", { name: "Edit schedule" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pull" })).toBeInTheDocument();
  });

  it("shows one card save action while editing an exercise", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Exercise name")).toHaveValue("Dumbbell Row");
    expect(screen.getByLabelText("Muscle group")).toHaveValue("Back");
    expect(screen.getAllByRole("button", { name: "Save exercise" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Cancel editing|Save Dumbbell Row/ })).not.toBeInTheDocument();
  });

  it("keeps an empty workout day focused on Add exercise and saves a library selection to that day", async () => {
    const defaultImplementation = api.getMockImplementation();
    api.mockImplementation(async (path: string, options?: RequestInit) => path === "/workout-plans" ? [{ ...plan, exercises: [] }] : defaultImplementation!(path, options));

    renderWorkout();
    expect(await screen.findByRole("heading", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByText("＋ Add exercise")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start workout" })).not.toBeInTheDocument();
    expect(screen.queryByText(/No exercises yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("＋ Add exercise"));
    fireEvent.click(screen.getByRole("button", { name: /Dumbbell Row/ }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-plans/day-pull/exercises/row", expect.objectContaining({ method: "PUT" })));
    expect(api).not.toHaveBeenCalledWith("/workout-program", expect.anything());
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("keeps the set rows aligned with the edited target set count", async () => {
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Sets"), { target: { value: "3" } });
    expect(screen.getByLabelText("Set 3 reps")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-plans/day-pull/exercises/row", expect.objectContaining({ method: "PUT" })));
    const save = api.mock.calls.find(([path, options]) => path === "/workout-plans/day-pull/exercises/row" && options?.method === "PUT")!;
    expect(JSON.parse(String(save[1].body))).toMatchObject({ sets: 3, setList: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }, { reps: 8, weight: 0 }] });
    expect(api).not.toHaveBeenCalledWith("/workout-program", expect.anything());
  });

  it("assigns an existing workout with buttons and saves it with the same draft", async () => {
    const restKey = weekdays.find(key => key !== dayKey)!;
    const restLabel = `${restKey[0].toUpperCase()}${restKey.slice(1)}`;
    renderWorkout();
    await screen.findByRole("button", { name: "Start workout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    const restDay = screen.getByRole("button", { name: restLabel.slice(0, 3) }).parentElement!;
    fireEvent.click(within(restDay).getByRole("button", { name: /Choose a workout/ }));

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pull" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/workout-program", expect.objectContaining({ method: "PUT" })));
    const save = api.mock.calls.find(([path, options]) => path === "/workout-program" && options?.method === "PUT")!;
    expect(JSON.parse(String(save[1].body)).days.find((day: { key: string }) => day.key === restKey)).toMatchObject({ label: restLabel, planId: "day-pull" });
  });

  it("starts without preset workouts and creates one through the workout picker", async () => {
    api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/workout-plans") return [];
      if (path === "/exercise-library") return [];
      if (path === "/workout-program" && options?.method === "PUT") {
        const payload = JSON.parse(String(options.body));
        return { days: payload.days, exerciseLibrary: payload.exerciseLibrary, plans: payload.plans.map((item: { id: string; name: string; exercises: { exerciseId: string; sets: number; reps: number; rest: number; tempo: string; setList: unknown[] }[] }) => ({ id: item.id, name: item.name, exercises: item.exercises.map(ref => ({ ...payload.exerciseLibrary.find((definition: { id: string }) => definition.id === ref.exerciseId), ...ref, id: ref.exerciseId })) })) };
      }
      if (path === "/workout-week" && options?.method === "PUT") return JSON.parse(String(options.body)).days;
      if (path === "/workout-week") return weekdays.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), planId: null }));
      if (path.startsWith("/workout-logs")) return { items: [], nextCursor: null, hasMore: false };
      if (path.startsWith("/workout-plans/") && options?.method === "PUT") return { id: path.split("/").at(-1), ...JSON.parse(String(options.body)) };
      throw new Error(`Unexpected API call: ${path}`);
    });
    renderWorkout();
    expect(await screen.findByRole("heading", { name: "Choose your first workout" })).toBeInTheDocument();
    expect(screen.queryByText(/Push · high rep|Pull · high rep/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose workout" }));
    fireEvent.click(screen.getByRole("button", { name: "＋ New workout" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New workout name" }), { target: { value: "Upper strength" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & use" }));
    expect(screen.getByText("＋ Add exercise")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start workout" })).not.toBeInTheDocument();
    expect(screen.queryByText(/No exercises yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("＋ Add exercise"));
    fireEvent.click(screen.getByRole("button", { name: "Create a new exercise" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    await waitFor(() => expect(api.mock.calls.some(([path, options]) => path.startsWith("/workout-plans/day-") && path.includes("/exercises/exercise-") && options?.method === "PUT")).toBe(true));
    const exerciseSave = api.mock.calls.find(([path, options]) => path.startsWith("/workout-plans/day-") && path.includes("/exercises/exercise-") && options?.method === "PUT")!;
    expect(JSON.parse(String(exerciseSave[1].body))).toMatchObject({ name: "New exercise", planName: "Upper strength", dayKey });
    expect(api).not.toHaveBeenCalledWith("/workout-program", expect.anything());
  });
});
