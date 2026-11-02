# IronTrack implementation roadmap

This document is the handoff point for future implementation sessions. Read it with [architecture.md](architecture.md), [phone-workflow.md](phone-workflow.md), and [PROGRESS.md](../PROGRESS.md) before changing app structure or adding a feature. Product scope is an account-based, dumbbell-focused fitness tracker that works well on a phone and desktop. Keep React/Vite as one responsive installable PWA; do not introduce Electron or duplicate platform apps unless the product goal changes.

## Current architecture

- `client/` is the TypeScript React/Vite PWA. React Router handles pages, TanStack Query handles API/server state, Zustand holds client preferences, Axios is the API transport, Zod validates forms and API data, Tailwind styles shared component patterns.
- `server/` is the TypeScript Express API. MongoDB/Mongoose persists each account's routine, workout, weight, wellness and push subscription data. Auth middleware scopes user-owned data by `ownerId`.
- `client/public/sw.js` caches the app shell and handles notification display/clicks. Web Push wakes the service worker while the UI is closed on supported browsers.
- The browser calls the authenticated `/api/notifications/*` endpoints. The server checks schedules once per minute, using each subscription's IANA timezone, and sends due push through VAPID/Web Push.
- Never put the VAPID private key, MongoDB URI, or auth signing secret in client variables, committed files, logs, or example values that look usable. Local secrets belong in ignored `server/.env`; deployment secrets belong in the API host's private environment settings.

## Completed in the current build

- Responsive workout/routine/wellness/settings flows and installed-PWA shell. Workout sessions support pause/resume, saved in-progress state, optional Auto progression after rest, and optional spoken exercise/set/tempo cues.
- Routine's live clock is isolated from the task-list render path; the one-second timer only updates the clock and an active timed task card.
- Scheduled routine tasks use prayer-bounded start times and a user-selected duration; the end is calculated, and client/server validation rejects prayer-window violations and overlaps. The selected routine date rolls over automatically at 1:00 AM local time without a manual reset.
- Workout-day navigation scrolls horizontally, including in edit mode; workout-day names remain free-form.
- Authenticated account deletion requires the current password and exact `DELETE` confirmation. The server awaits a transaction-backed cascade across account-owned collections, clears the current cookies, and rejects later requests made with access tokens from other devices.
- Workout history saves only completed sets. A skipped exercise does not block finishing a session or cause its uncompleted sets to appear in history.
- Workout log validation rejects impossible calendar dates and malformed history limits; a concurrent retry with an existing idempotency key returns the saved log.
- Routine completions and finished workout logs can queue locally for the signed-in account and replay when connectivity returns. Other writes still require the API.
- Routine task and workout reminders can be saved as device push subscriptions in MongoDB.
- Prayer reminders use each device's saved prayer times and IANA timezone, including daylight-saving changes and local calendar dates.
- Server-generated VAPID/Web Push sends task-time and 9 AM workout reminders, plus optional water/movement reminders at 10 AM, 2 PM, and 6 PM when daily goals remain unmet.
- The API prevents repeat delivery per user, device schedule, date, and task; completed tasks and workouts are skipped. Expired browser subscriptions are removed.
- Wellness lets each browser/device opt in, test server push, change reminder preferences, or unsubscribe. The local foreground reminder loop remains as a fallback for devices without an active server subscription.
- Local VAPID keys were created in ignored `server/.env`. Copy those variables to the production API environment only through the deployment provider's secret settings. Do not copy them into `.env.example` with actual values.
- The repository does not include Docker/Compose packaging. Deploy the API from source and provision MongoDB separately. Auth verification and recovery mail are sent directly through the API's SMTP transport; no Redis worker is required.
- Frontend and backend production builds succeeded after the Web Push implementation. The API now stays listening and retries MongoDB connection every 30 seconds; `/api/health` reports `503 degraded` until the database reconnects. Atlas connectivity varied during this session, so confirm health before using server-backed features.

## Before production use

1. Deploy the frontend and API on HTTPS. For cookie authentication, prefer one site origin with the API proxied under `/api`, or carefully configure cross-site cookies and CORS.
2. Set `MONGODB_URI`, `AUTH_JWT_SECRET`, `AUTH_REFRESH_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, `CLIENT_URL`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` in the API host's private environment. Set the deployed client/API origins and proxy settings.
3. Use a MongoDB replica set or sharded cluster; transactions protect workout-program updates and account-data deletion from partial writes.
4. Verify that `CLIENT_ORIGIN` contains only the deployed client origins and confirm `TRUST_PROXY`, HTTPS, health checks, and production startup.
5. Ensure the free API host's sleep behavior is acceptable. Web Push can wait in the browser push service, but scheduled reminders are evaluated only while the Express process is awake. A sleeping free instance may miss its schedule until it wakes; use an always-on host if punctual reminders matter.
6. Open Wellness on every phone/browser, grant notification permission, enable background notifications, and press **Send server test**. Android and desktop need HTTPS (localhost is exempt). iPhone/iPad push requires a compatible installed web app and current OS/browser support; verify on the target device.
7. Verify backend/API health, login, routine completion, a test push, task reminder timing, timezone behavior, and notification click navigation on the deployed URL. Keep real secrets out of screenshots and logs.

## Next phases, in order

### Phase 1 — Deployment readiness and smoke checks

- Finish production hosting and set secrets on the hosting providers.
- Confirm auth cookies across the deployed client/API origin arrangement.
- Restrict CORS, verify `TRUST_PROXY`, HTTPS, health checks, and production startup.
- Add an operational runbook for redeploy, MongoDB failure, VAPID rotation, and restoring service.
- Validate push from the actual phone. Browser and OS delivery cannot be fully confirmed by a build alone.

### Phase 2 — Extend data safety and resilient use

- Consider offline support for weight and wellness edits only after defining conflict behavior; schedule and plan replacement should remain online unless a safe merge policy exists.
- Keep visible pending/error states for the supported routine-completion and workout-log queue. Do not silently report other offline writes as saved.
- Add rate-limited, authenticated data backup/export and restore only if the product owner re-approves it. Export/restore and cloud sync were previously excluded from the requested feature scope.
- Define retention and cleanup for push-delivery dedupe records, logs, and inactive device subscriptions.

### Phase 3 — Training quality and progress insights

- Review the imported/default dumbbell plans and exercise guidance for completeness and safe, clear progression.
- Improve progression insights from workout history (volume, reps, personal bests, consistency) and offer configurable rest guidance without blocking the workout flow.
- Add owner-scoped correction/deletion for mistaken history entries, then consider one-session exercise substitutions/reordering when equipment is occupied.
- Support per-set rest/tempo prescriptions and explain the assumptions behind personal-best estimates.
- Keep wellness and notification behavior tied to user preferences and avoid noisy reminders.

### Phase 4 — Routine and habit polish

- Validate routine task ordering, subtasks, recurring/day-type rules, and automatic 1 AM date rollover with real user workflows.
- Confirm the deployed SMTP provider delivers registration verification messages; unit tests do not establish live email delivery.
- Add optional reminder scheduling controls only if current per-task reminders and wellness schedule prove insufficient.
- Improve analytics based on persisted data, with clear empty states and timezone-consistent date labels.

### Phase 5 — Quality and maintainability

- Add focused integration tests for auth-scoped APIs, push subscription upsert/unsubscribe, task completion suppression, timezone day boundaries, duplicate suppression, and expired subscription cleanup.
- Add frontend tests for enabling/disabling push, denied permission, unsupported browser, and server-config-missing states.
- Add a deploy smoke test and monitor server errors without recording notification payloads or secrets.
- Review bundle chunk sizes and continue lazy-loading chart/large optional views as new features land.
- Review dependency audit findings before upgrades; do not use broad force-upgrades without checking breaking changes.

### 2026-11-02 review update

- Completed local security hardening, endpoint rate limits, stricter input handling, unused dependency cleanup, and named MongoDB indexes; confirmed the key indexes and a workout-history index scan in the connected database.
- Full server/client tests, both builds, and dependency audit pass. See [the detailed quality and security review](quality-security-review-2026-11-02.md) for scores, standards references, and remaining work.
- Live SMTP/push delivery, production hosting, shared rate limits for multiple instances, and manual cross-device accessibility testing are still outstanding.

## Handoff rules

- Make one coherent phase at a time and update this file plus `PROGRESS.md` when a phase changes.
- Preserve existing API paths and stored data formats unless a migration is included.
- Do not add export/restore, cloud sync, payments, email delivery, or multi-user features without renewed product approval.
- Avoid adding a package when browser APIs or existing dependencies already solve the need.
- Do not claim phone push delivery is verified until it has been tested on the deployed phone/browser. Build success verifies compilation only.
