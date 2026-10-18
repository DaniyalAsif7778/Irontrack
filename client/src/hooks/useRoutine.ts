import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { TaskFormValues } from "../schemas/routine";
import type { Day, Schedule, Task, TaskEditing } from "../types";
import { queryKeys } from "./queryKeys";

export function useRoutineDay(date: string) {
  return useQuery({ queryKey: queryKeys.routine.day(date), queryFn: () => api<Day>(`/routine/days/${date}`) });
}

export function useRoutineMutations(date: string) {
  const queryClient = useQueryClient();
  const invalidateRoutine = () => queryClient.invalidateQueries({ queryKey: queryKeys.routine.days });
  const invalidateAnalytics = () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics });

  const completeTask = useMutation({
    mutationFn: (task: Task) => api(`/routine/tasks/${task._id}/completion/${date}`, { method: "PUT", body: JSON.stringify({ completed: !task.completed }) }),
    onSuccess: () => Promise.all([invalidateRoutine(), invalidateAnalytics()]),
  });
  const saveSubtasks = useMutation({
    mutationFn: ({ task, subtasks }: { task: Task; subtasks: Task["subtasks"] }) => api(`/routine/tasks/${task._id}`, { method: "PATCH", body: JSON.stringify({ subtasks }) }),
    onSuccess: invalidateRoutine,
  });
  const saveTask = useMutation({
    mutationFn: ({ current, value, dayType }: { current: TaskEditing | null; value: TaskFormValues; dayType?: Day["dayType"] }) => current?.task
      ? api(`/routine/tasks/${current.task._id}`, { method: "PATCH", body: JSON.stringify(value) })
      : api("/routine/tasks", { method: "POST", body: JSON.stringify({ ...value, dayType, block: current?.block }) }),
    onSuccess: () => Promise.all([invalidateRoutine(), invalidateAnalytics()]),
  });
  const removeTask = useMutation({
    mutationFn: (id: string) => api(`/routine/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => Promise.all([invalidateRoutine(), invalidateAnalytics()]),
  });

  return { completeTask, saveSubtasks, saveTask, removeTask };
}

export function useRoutineSchedule(dayType: "weekday" | "weekend") {
  return useQuery({ queryKey: queryKeys.routine.schedule(dayType), queryFn: () => api<Schedule>(`/routine/schedules/${dayType}`) });
}

export function useCopySchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ source, target }: { source: "weekday" | "weekend"; target: "weekday" | "weekend" }) => api("/routine/schedules/copy", { method: "POST", body: JSON.stringify({ sourceDayType: source, targetDayType: target }) }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.routine.schedules }),
      queryClient.invalidateQueries({ queryKey: queryKeys.routine.days }),
    ]),
  });
}
