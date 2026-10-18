import { Block, DayType } from "../constant.js";

const blockFromSection: Record<string, Block> = { post_fajr: "fajr", post_dhuhr: "dhuhr", post_asr: "asr", post_maghrib: "maghrib" };
export type ImportTask = { dayType: DayType; block: Block; title: string; description: string; type: string; priority: string; category: string; duration: number; dueDate: string; reminderTime: string; subtasks: { title: string; completed: boolean }[]; completedDate?: string };

export function extractBackup(payload: any) {
  const state = payload?.data?.routine_state_v2;
  const routineType: DayType = payload?.data?.routine_type === "weekend" ? "weekend" : "weekday";
  const tasks: ImportTask[] = [];
  for (const [section, source] of Object.entries(state?.tempTasks ?? {})) {
    const block = blockFromSection[section]; if (!block || !Array.isArray(source)) continue;
    for (const raw of source as any[]) {
      if (!raw?.title) continue;
      const completedDate = raw.status === "completed" ? String(raw.completedAt ?? raw.dueDate ?? "").slice(0, 10) : undefined;
      tasks.push({ dayType: routineType, block, title: String(raw.title), description: String(raw.description ?? ""), type: String(raw.type ?? "general"), priority: ["low", "medium", "high"].includes(raw.priority) ? raw.priority : "medium", category: String(raw.category ?? "Personal"), duration: Number(raw.duration) || 0, dueDate: String(raw.dueDate ?? ""), reminderTime: String(raw.reminderTime ?? ""), subtasks: Array.isArray(raw.subtasks) ? raw.subtasks.filter((s: any) => s?.title).map((s: any) => ({ title: String(s.title), completed: Boolean(s.completed) })) : [], completedDate: /^\d{4}-\d{2}-\d{2}$/.test(completedDate ?? "") ? completedDate : undefined });
    }
  }
  const weights = Array.isArray(payload?.data?.body_weight_log) ? payload.data.body_weight_log.filter((x: any) => /^\d{4}-\d{2}-\d{2}$/.test(x?.date ?? "") && Number(x.weight) > 0 && ["kg", "lb"].includes(x.unit)).map((x: any) => ({ date: x.date, weight: Number(x.weight), unit: x.unit })) : [];
  return { tasks, weights };
}
