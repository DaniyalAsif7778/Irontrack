const projectKey = process.env.POSTHOG_PROJECT_API_KEY?.trim();
const host = (process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/$/, "");

/** Best-effort, content-free delivery telemetry. Never include user IDs, notification copy, or workout values. */
export function trackNotificationEvent(event: string, properties: Record<string, string | number | boolean | null> = {}) {
  if (!projectKey) return;
  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: projectKey,
      event,
      distinct_id: "irontrack-notification-service",
      properties: { subsystem: "notifications", ...properties },
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
}
