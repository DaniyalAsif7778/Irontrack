import axios from "axios";

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const remoteBase = import.meta.env.DEV
  ? (configuredBase || "http://127.0.0.1:4000/api").replace(/\/$/, "")
  : "/api";
export const isRemoteApi = () => true;
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

const noRefreshPaths = new Set([
  "/auth/login", "/auth/register", "/auth/refresh", "/auth/logout",
  "/auth/verify-email", "/auth/resend-verification", "/auth/password/forgot", "/auth/password/reset",
]);

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
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
