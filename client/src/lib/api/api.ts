import axios from "axios";

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const localDevBase = import.meta.env.DEV
  ? "http://127.0.0.1:4001/api"
  : undefined;
const remoteBase = import.meta.env.DEV
  ? (configuredBase || localDevBase)?.replace(/\/$/, "")
  : "/api";
export const isRemoteApi = () => Boolean(remoteBase);
const http = axios.create({
  baseURL: remoteBase,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
let refreshPromise: Promise<boolean> | null = null;

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = http.post("/auth/refresh")
      .then(() => true)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

const noRefreshPaths = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"]);

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}
const storageKey = "irontrack_mvp_temporary_data";
type LocalTask = Record<string, any> & { _id: string; dayType: string; block: any; completions?: any };
type LocalData = { tasks: LocalTask[]; weights: any[] };
const id = () => crypto.randomUUID();
const seed = (): LocalData => ({ tasks: [
  ["fajr", "Atomic Habits", "Current status: read the first law of habit making and extract the learning.", "reading", "medium", "Personal", true], ["fajr", "Seerah Reading", "Current book: The biography of the Prophet Muhammad (S.A.W).", "reading", "high", "Learning", false], ["dhuhr", "Improve previous projects", "Make the weather app more robust and handle edge cases.", "deep_work", "low", "Work", false], ["dhuhr", "BUILD EMS", "Integrate the signup process using Axios, TanStack Query, Zustand, and FormData.", "deep_work", "medium", "Work", false], ["dhuhr", "Learning Arabic", "Practice Murakkab Tam for twenty minutes.", "deep_work", "high", "Learning", true], ["asr", "Exercise for 40 min", "", "physical", "high", "Personal", false]
].map(([block,title,description,type,priority,category,done], index) => ({ _id: `seed-${index}`, dayType: "weekday", block, order:index, title, description, type, priority, category, duration:0, dueDate:"", reminderTime:"", subtasks:[], completions: done ? { "2026-09-04": true } : {} })), weights: [{ _id:"weight-seed", date:"2026-08-30", weight:95.05, unit:"kg" }] });
const data = (): LocalData => { const raw = localStorage.getItem(storageKey); if (raw) return JSON.parse(raw); const initial = seed(); localStorage.setItem(storageKey, JSON.stringify(initial)); return initial; };
const save = (value: LocalData) => localStorage.setItem(storageKey, JSON.stringify(value));
const dayType = (date: string) => [0,6].includes(new Date(`${date}T00:00:00`).getDay()) ? "weekend" : "weekday";
const preferredWeightUnit = (): "kg" | "lb" => {
  try {
    const stored = JSON.parse(localStorage.getItem("irontrack_settings") ?? "null");
    return stored?.state?.preferences?.weightUnit === "lb" ? "lb" : "kg";
  } catch { return "kg"; }
};
const local = async <T>(path: string, options: RequestInit): Promise<T> => {
  const store = data(), method = options.method ?? "GET", body = typeof options.body === "string" ? JSON.parse(options.body) : options.body as any;
  if (path.startsWith("/routine/days/")) { const date = path.split("/").pop()!, type = dayType(date), labels: Record<string,string> = {fajr:"Fajr",dhuhr:"Dhuhr",asr:"Asr",maghrib:"Maghrib",isha:"Isha"}; const blocks = Object.entries(labels).map(([block,label])=>{ const tasks = store.tasks.filter(t=>t.dayType===type&&t.block===block).map(t=>({...t,completed:Boolean(t.completions?.[date] || t.status==="completed")})); return {id:block,label,tasks,completed:tasks.filter(t=>t.completed).length,total:tasks.length}; }); return {date,dayType:type,blocks,progress:{completed:blocks.reduce((n,b)=>n+b.completed,0),total:blocks.reduce((n,b)=>n+b.total,0)}} as T; }
  if (path.startsWith("/analytics")) {
    const query = new URLSearchParams(path.split("?")[1] ?? ""), days = Math.max(1, Number(query.get("days")) || 7);
    const todayValue = query.get("today");
    const today = todayValue ? new Date(`${todayValue}T12:00:00`) : new Date();
    const activity = Array.from({ length: days }, (_, index) => {
      const date = new Date(today); date.setDate(today.getDate() - (days - index - 1));
      const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      const tasks = store.tasks.filter(task => task.dayType === dayType(key));
      const completed = tasks.filter(task => task.completions?.[key]).length;
      return { date: key, completed, total: tasks.length, rate: tasks.length ? Math.round(completed / tasks.length * 100) : 0 };
    });
    const startDate = activity[0]?.date ?? "";
    const displayUnit = preferredWeightUnit();
    const entries = [...store.weights].filter(weight => weight.date >= startDate).sort((a, b) => a.date.localeCompare(b.date)).map(weight => {
      const converted = weight.unit === displayUnit ? weight.weight : displayUnit === "lb" ? weight.weight * 2.2046226218 : weight.weight / 2.2046226218;
      return { ...weight, weight: Math.round(converted * 100) / 100, unit: displayUnit };
    });
    const latest = entries.length ? entries[entries.length - 1] : null;
    const change = entries.length > 1 ? Math.round((latest.weight - entries[0].weight) * 100) / 100 : null;
    const totalCompleted = store.tasks.reduce((sum, task) => sum + Object.values(task.completions ?? {}).filter(Boolean).length, 0);
    return { days, totalCompleted, periodCompleted: activity.reduce((sum, item) => sum + item.completed, 0), activity, weightTrend: { entries, latest, change } } as T;
  }
  if (path === "/routine/tasks" && method === "POST") { const task = {_id:id(),...body,order:store.tasks.length,subtasks:body.subtasks??[],completions:{}}; store.tasks.push(task); save(store); return task as T; }
  const taskMatch = path.match(/^\/routine\/tasks\/([^/]+)(?:\/completion\/(.+))?$/); if (taskMatch) { const task = store.tasks.find(t=>t._id===taskMatch[1]); if (!task) throw new Error("Task not found"); if (taskMatch[2]) { task.completions ??={}; task.completions[taskMatch[2]]=body.completed; task.status=body.completed?"completed":"pending"; save(store); return {taskId:task._id,date:taskMatch[2],completed:body.completed} as T; } if (method === "PATCH") { Object.assign(task,body); save(store); return task as T; } if (method === "DELETE") { store.tasks=store.tasks.filter(t=>t!==task); save(store); return undefined as T; } }
  if (path === "/weight-logs") { if (method === "GET") return [...store.weights].sort((a,b)=>b.date.localeCompare(a.date)) as T; if (method === "POST") { const existing=store.weights.find(w=>w.date===body.date); const weight=existing?Object.assign(existing,body):{_id:id(),...body}; if(!existing)store.weights.push(weight);save(store);return weight as T; } }
  const weightMatch=path.match(/^\/weight-logs\/([^/]+)$/); if(weightMatch){const w=store.weights.find(x=>x._id===weightMatch[1]);if(!w)throw new Error("Weight log not found");if(method==="DELETE"){store.weights=store.weights.filter(x=>x!==w);save(store);return undefined as T;}Object.assign(w,body);save(store);return w as T;}
  throw new Error(`Temporary storage does not support ${method} ${path}`);
};
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!remoteBase) return local<T>(path, options);

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  try {
    const config = {
      url: path,
      method: options.method ?? "GET",
      data: options.body,
      headers: Object.fromEntries(headers.entries()),
      signal: options.signal ?? undefined,
    };
    let response;
    try {
      response = await http.request<T>(config);
    } catch (reason) {
      const authPath = path.split("?", 1)[0];
      if (!axios.isAxiosError(reason) || reason.response?.status !== 401 || noRefreshPaths.has(authPath)) throw reason;
      if (!await refreshSession()) throw reason;
      response = await http.request<T>(config);
    }
    return response.data;
  } catch (reason) {
    if (axios.isAxiosError(reason)) {
      if (!reason.response) throw new ApiError("IronTrack could not reach the server. Check your connection and try again.", 0);
      const body = reason.response.data as { error?: string } | undefined;
      throw new ApiError(body?.error ?? reason.message ?? "Request failed", reason.response.status);
    }
    throw reason;
  }
}
