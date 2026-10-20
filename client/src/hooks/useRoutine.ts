import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../lib/api/api";
import { enqueueOfflineAction } from "../lib/api/offlineQueue";
import type { TaskFormValues } from "../schemas/routine";
import type { Day, Schedule, Task, TaskEditing } from "../types";
import { queryKeys } from "./queryKeys";

export function useRoutineDay(date: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return useQuery({ queryKey: [...queryKeys.routine.day(date), timezone], queryFn: () => api<Day>(`/routine/days/${date}?timezone=${encodeURIComponent(timezone)}`) });
}

export function useRoutineMutations(date: string, accountId?: string) {
  const queryClient = useQueryClient();
  const invalidateRoutine = () => queryClient.invalidateQueries({ queryKey: queryKeys.routine.days });
  const invalidateAnalytics = () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
  const invalidateEvents = () => queryClient.invalidateQueries({ queryKey: ["routine-events"] });

  const completeTask = useMutation({
    mutationFn: async (task: Task) => {
      const path = `/routine/tasks/${task._id}/completion/${date}`;
      const body = { completed: !task.completed, actionId: crypto.randomUUID() };
      try { return await api(path, { method: "PUT", body: JSON.stringify(body) }); }
      catch (error) {
        if (!accountId || !(error instanceof ApiError && error.status === 0)) throw error;
        enqueueOfflineAction({ id: body.actionId, accountId, kind: "routine_completion", path, body });
        return { queuedOffline: true };
      }
    },
    onSuccess: () => Promise.all([invalidateRoutine(), invalidateAnalytics(), invalidateEvents()]),
  });
  const saveSubtasks = useMutation({
    mutationFn: ({ task, subtasks }: { task: Task; subtasks: Task["subtasks"] }) => api(`/routine/tasks/${task._id}`, { method: "PATCH", body: JSON.stringify({ subtasks, actionId: crypto.randomUUID() }) }),
    onSuccess: invalidateRoutine,
  });
  const saveTask = useMutation({
    mutationFn: ({ current, value, dayType }: { current: TaskEditing | null; value: TaskFormValues; dayType?: Day["dayType"] }) => current?.task
      ? api(`/routine/tasks/${current.task._id}`, { method: "PATCH", body: JSON.stringify({ ...value, actionId: crypto.randomUUID() }) })
      : api("/routine/tasks", { method: "POST", body: JSON.stringify({ ...value, actionId: crypto.randomUUID(), dayType, block: current?.block }) }),
    onSuccess: () => Promise.all([invalidateRoutine(), invalidateAnalytics()]),
  });
  const removeTask = useMutation({
    mutationFn: (id: string) => api(`/routine/tasks/${id}`, { method: "DELETE", body: JSON.stringify({ actionId: crypto.randomUUID() }) }),
    onSuccess: () => Promise.all([invalidateRoutine(), invalidateAnalytics()]),
  });

  const action = (task: Task, verb: "start" | "queue" | "extend" | "snooze", minutes?: number) => api(`/routine/tasks/${task._id}/occurrences/${date}/${verb}`, {
    method: "POST",
    body: JSON.stringify({ actionId: crypto.randomUUID(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", ...(minutes ? { minutes } : {}) }),
  });
  const onActionSuccess = () => Promise.all([invalidateRoutine(), invalidateEvents()]);
  const startTask = useMutation({ mutationFn: (task: Task) => action(task, "start"), onSuccess: onActionSuccess });
  const queueTask = useMutation({ mutationFn: (task: Task) => action(task, "queue"), onSuccess: onActionSuccess });
  const extendTask = useMutation({ mutationFn: (task: Task) => action(task, "extend"), onSuccess: onActionSuccess });
  const snoozeTask = useMutation({ mutationFn: ({ task, minutes }: { task: Task; minutes: number }) => action(task, "snooze", minutes), onSuccess: onActionSuccess });

  return { completeTask, saveSubtasks, saveTask, removeTask, startTask, queueTask, extendTask, snoozeTask };
}

export function useRoutineSchedule(dayType: "weekday" | "weekend") {
  return useQuery({ queryKey: queryKeys.routine.schedule(dayType), queryFn: () => api<Schedule>(`/routine/schedules/${dayType}`) });
}

export function useCopySchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ source, target }: { source: "weekday" | "weekend"; target: "weekday" | "weekend" }) => api("/routine/schedules/copy", { method: "POST", body: JSON.stringify({ sourceDayType: source, targetDayType: target, actionId: crypto.randomUUID() }) }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.routine.schedules }),
      queryClient.invalidateQueries({ queryKey: queryKeys.routine.days }),
    ]),
  });
}

export function useRoutineEventAnalytics(days = 14) {
  return useQuery({ queryKey: queryKeys.routineEvents(days), queryFn: () => api<{ days: number; counts: Record<string, { count: number; avgResponseMs: number | null }>; completionRate: number; totalEvents: number; averageResponseMs: number | null; recentEvents: Array<{ eventId: string; date: string; type: string; occurredAt: string; responseTimeMs: number | null; pushStatus?: string; taskId?: { title: string } | null }> }>(`/routine/events/analytics?days=${days}`) });
}
