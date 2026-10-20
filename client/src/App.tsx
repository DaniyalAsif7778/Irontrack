import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useRoutes } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import AppShell from "./Layout";
import { HomePage, RoutinePage, TaskDialog, ScheduleManager, WeightPage, WorkoutPage } from "./pages/pages";
import { api } from "./lib/api/api";
import { useAnalytics, useRoutineDay, useRoutineMutations, useWeightLogs, useWeightMutations } from "./hooks/hooks";
import { ironToday } from "./utils/date";
import type { AnalyticsData, AppView, Day, Task, TaskEditing, Weight } from "./types";
import type { TaskFormValues } from "./schemas/routine";
import type { WeightFormValues } from "./schemas/weight";
import { useAppStore } from "./stores/appStore";
import { useSession } from "./components/AuthGate";
import NotificationScheduler from "./components/NotificationScheduler";
import WellnessPage from "./pages/wellness/WellnessPage";

const AnalyticsPage = lazy(() => import("./pages/analytics/AnalyticsPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const WorkoutStatsPage = lazy(() => import("./pages/workout/WorkoutStatsPage"));
const ExerciseDetailPage = lazy(() => import("./pages/workout/ExerciseDetailPage"));

export default function App() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const view = (location.pathname.startsWith("/exercise/") || location.pathname.startsWith("/workout/") ? "workout" : location.pathname.slice(1) || "home") as AppView;
  const setView = (nextView: AppView) => navigate(nextView === "home" ? "/" : `/${nextView}`);
  const date = useAppStore(state => state.selectedDate);
  const setDate = useAppStore(state => state.setSelectedDate);
  const analyticsDays = useAppStore(state => state.analyticsDays);
  const setAnalyticsDays = useAppStore(state => state.setAnalyticsDays);
  const storedPreferences = useAppStore(state => state.preferences);
  const preferences = user?.preferences ?? storedPreferences;
  const setPreferences = useAppStore(state => state.setPreferences);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TaskEditing | null>(null);
  const dayQuery = useRoutineDay(date);
  const weightsQuery = useWeightLogs();
  const analyticsQuery = useAnalytics(analyticsDays);
  const { completeTask, saveSubtasks: saveSubtasksMutation, saveTask: saveTaskMutation, removeTask: removeTaskMutation } = useRoutineMutations(date);
  const { saveWeight: saveWeightMutation, removeWeight: removeWeightMutation } = useWeightMutations();
  const day = dayQuery.data ?? null;
  const selectedDayType = day?.dayType ?? ([0, 6].includes(new Date(`${date}T12:00:00`).getDay()) ? "weekend" : "weekday");
  const weights = weightsQuery.data ?? [];
  const analytics = analyticsQuery.data ?? null;
  const latest = weights[0];

  useEffect(() => {
    if (user) setPreferences(user.preferences);
  }, [user, setPreferences]);

  useEffect(() => {
    const queryError = dayQuery.error ?? weightsQuery.error ?? analyticsQuery.error;
    if (queryError) setError(queryError.message);
  }, [dayQuery.error, weightsQuery.error, analyticsQuery.error]);

  useEffect(() => {
    if (error) {
      toast.error(error, { id: error });
      setError("");
    }
  }, [error]);

  const title = useMemo(() => format(parseISO(date), "EEEE, MMM d"), [date]);

  async function complete(task: Task) {
    try { await completeTask.mutateAsync(task); }
    catch (value) { setError((value as Error).message); }
  }

  async function saveSubtasks(task: Task, subtasks: Task["subtasks"]) {
    try { await saveSubtasksMutation.mutateAsync({ task, subtasks }); }
    catch (value) { setError((value as Error).message); }
  }

  async function saveTask(value: TaskFormValues) {
    try {
      await saveTaskMutation.mutateAsync({ current: editing, value, dayType: selectedDayType });
      setEditing(null);
    } catch (reason) { setError((reason as Error).message); }
  }

  async function removeTask(id: string) {
    if (!confirm("Delete this routine task?")) return;
    try { await removeTaskMutation.mutateAsync(id); }
    catch (reason) { setError((reason as Error).message); }
  }

  async function saveWeightEntry(value: WeightFormValues) {
    try {
      await saveWeightMutation.mutateAsync(value);
    } catch (reason) { setError((reason as Error).message); throw reason; }
  }

  async function removeWeight(id: string) {
    try { await removeWeightMutation.mutateAsync(id); }
    catch (reason) { setError((reason as Error).message); }
  }

  const page = useRoutes([
    { path: "/", element: <HomePage day={day} latest={latest} userName={user?.name} onRoutine={() => setView("routine")} /> },
    { path: "/home", element: <HomePage day={day} latest={latest} userName={user?.name} onRoutine={() => setView("routine")} /> },
    { path: "/workout", element: <WorkoutPage onError={setError} /> },
    { path: "/workout/stats", element: <Suspense fallback={<p>Loading workout stats…</p>}><WorkoutStatsPage onError={setError} /></Suspense> },
    { path: "/exercise/:exerciseId", element: <Suspense fallback={<p>Loading exercise history…</p>}><ExerciseDetailPage onError={setError} /></Suspense> },
    { path: "/routine", element: <RoutinePage date={date} title={title} day={day} dayType={selectedDayType} dayLoading={dayQuery.isPending} dayError={dayQuery.error instanceof Error ? dayQuery.error.message : null} setDate={setDate} complete={complete} edit={setEditing} remove={removeTask} saveSubtasks={saveSubtasks} onError={setError} /> },
    { path: "/analytics", element: <Suspense fallback={<p>Loading analytics…</p>}><AnalyticsPage data={analytics} onRange={setAnalyticsDays} /></Suspense> },
    { path: "/weight", element: <WeightPage latest={latest} weights={weights} save={saveWeightEntry} remove={removeWeight} defaultUnit={preferences.weightUnit} /> },
    { path: "/schedules", element: <ScheduleManager onError={setError} /> },
    { path: "/settings", element: <Suspense fallback={<p>Loading settings…</p>}><SettingsPage user={user} /></Suspense> },
    { path: "/wellness", element: <WellnessPage onError={setError} /> },
    { path: "*", element: <HomePage day={day} latest={latest} userName={user?.name} onRoutine={() => setView("routine")} /> },
  ]);
  return <AppShell view={view} setView={setView} user={user} signOut={signOut} focusMinutes={preferences.focusMinutes} breakMinutes={preferences.breakMinutes}>
    {page}
    <NotificationScheduler />
    {editing && <TaskDialog editing={editing} onClose={() => setEditing(null)} onSave={saveTask} />}
  </AppShell>;
}
