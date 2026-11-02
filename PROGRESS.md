# Implementation progress

For the current checkout analysis, phase sequencing, production setup, and handoff, read [the project analysis](docs/project-analysis-2026-11-02.md) and [docs/roadmap.md](docs/roadmap.md).

The 2026-11-02 full-stack security, quality, Pakistan/international readiness, SEO, index, local-demo, and signed-in UX review is in [the quality and security review](docs/quality-security-review-2026-11-02.md). The review's 126 server and 70 client tests, production builds, dependency audit, local API health, MongoDB connection, and database index plan all passed as detailed there. The live SMTP flow, production deployment, and manual accessibility/device checks remain unverified. The latest UX changes improve routine-dialog keyboard access and analytics chart/data/retry behavior; the public landing page was left unchanged.

## Upgrade phases

### Phase 1 — Responsive PWA foundation (complete)

- Reworked the app shell for a fixed desktop sidebar and mobile bottom navigation with safe-area spacing.
- Added an install manifest, app icon, production service-worker registration, and cached app shell/build assets.
- Kept backup import reachable on both layouts and added an actionable API connection error.
- At this initial phase, only the cached shell was available offline. The later offline queue now covers routine completion and finished workout logs only; other changes still need the API.

### Phase 2 — Dumbbell workout tracking (complete)

- Added the six-day Push/Pull/Legs schedule with higher-rep variants and a weekly rest day.
- Added an exercise plan view with cues and an editor for exercise details.
- Added an active workout flow with persisted in-progress sets, a stopwatch, rest countdowns, and completion summaries.
- Added MongoDB-backed workout plans and session history, including server-side payload validation and duplicate-completion protection.
- Added the Workout screen to desktop and mobile navigation.

### Phase 3 — Routine focus tools (complete)

- Restyled prayer cards around the reference: anchor heading, completion count, progress bar, after-prayer divider, compact task metadata, and responsive task cards.
- Added subtask creation and completion, saved through the existing task update API.
- Added a global 45-minute focus / 15-minute break timer started from a task; pause, resume, reset, stop, and state persistence across refreshes are supported.
- The timer stays visible across navigation. It uses browser notifications only when permission has already been granted.
- Added keyboard-visible focus styles, reduced-motion handling, mobile safe-area spacing, and an actionable empty state when a routine has no tasks.
- Verified the live API from the current mobile/desktop frontend origin. Timer durations snapshot when a session starts, so preference changes mid-session do not alter them.

### Phase 4 — Accounts and private data (complete)

- Added account creation, sign-in, sign-out, session lookup, and an HttpOnly signed session cookie.
- Required authentication for API data routes and scoped routine tasks, weights, workout plans/logs, and analytics to the current account.
- Added per-account unique indexes for dates and workout schedules. The database connection removes only the old conflicting indexes; legacy unowned records remain untouched and inaccessible.
- Development defaults to the local API; account-backed data does not fall back to mock local-storage records.
- Added `AUTH_JWT_SECRET` configuration guidance plus server session/validation and frontend form validation tests.
- Verified both production TypeScript/Vite builds and both workspace test suites.

### Phase 5 — Settings and personalization (complete)

- Added a responsive Settings page for account display name, default weight unit, focus length, break length, and browser notification permission.
- Saved account preferences to MongoDB and exposed them through the authenticated account session.
- Applied the weight-unit preference to new logs and normalized mixed-unit analytics trends into the selected unit.
- Focus and break lengths apply to newly started timers; an active timer keeps the durations it started with. Timer state is kept separate per account on a shared device.
- Added account preference settings and validation coverage.

## Completed

- Separate React/Vite frontend and Express/MongoDB TypeScript backend.
- Weekday/weekend routine templates with fixed Fajr, Dhuhr, Asr, Maghrib, and Isha blocks.
- Full routine task fields, daily completion tracking, progress counters, and weight-log CRUD.
- Backend validation and backup-mapping tests; production builds pass for both applications.

## Backup mapping

- `routine_state_v2.tempTasks.post_fajr|post_dhuhr|post_asr|post_maghrib` becomes routine tasks in the matching fixed block.
- `body_weight_log` becomes weight-log records.
- Temporary-task `completed` status becomes a dated completion using its `completedAt` (or due date).
- Workout data is mapped separately: legacy `*_high_rep` day names are normalized; workout plans, completed sets, session history, and per-exercise progression can be persisted. Historical duration values at or below 180 are interpreted as minutes; larger values are interpreted as seconds, based on the legacy export formats.
- Analytics, notifications, and legacy task storage are not imported.

## Configuration still required

Local development uses Vite on port 5174 and the API on port 4000 by default. MongoDB-backed account authentication and the local MongoDB connection were verified on 2026-11-02. The corrected workout export was imported without overwriting existing records: 4 plans, 5 sessions, and 15 progression records. The corrected routine backup has no routine tasks or weight records. The routine screen now explains that and offers a first-task action. The imported workout plans and session history are visible in the app.

## 2026-09-26 update
- MongoDB connection configuration added locally (credentials are stored only in ignored server/.env).
- Client now targets the local Express API through ignored client/.env; existing backup data will be imported into MongoDB.

## 2026-10-18 — Reference audit and interaction pass

- Kept the reference theme tokens and made the desktop shell slimmer; mobile now shows four primary destinations and a Profile shortcut for Wellness, Settings, Body weight, and Schedules.
- Added GSAP page transitions and ScrollTrigger reveals for top-level page sections. Motion is skipped when the OS requests reduced motion.
- Active workouts now support pause/resume and an explicit End action with a discard confirmation. Pausing freezes workout and rest timers. Previous session reps and load prefill matching exercises to reduce repeated entry; saved duration excludes paused time.
- Removed the user-facing backup import control and API route per the product direction. Data already imported into MongoDB is unchanged. Cloud sync and export/restore are intentionally excluded.

### Reference coverage

- **Implemented:** PPL plan and high-rep days, exercise plan editor, persisted workout sessions with pause/resume/end, set logging and rest timer, workout history, five workout analytics tabs, exercise history and estimated PRs, prayer-anchored tasks/subtasks and persistent timer, routine completion analytics, schedule management, body-weight logging/trend, water and movement check-ins, reminder settings and upcoming reminder center, account/preferences, responsive PWA shell, install guidance, and service-worker app-shell caching.
- **Partial:** The PWA shell can load after a prior visit. Routine completions and finished workout logs queue per account while offline; weight, wellness, settings, schedule, and plan edits still need the API. Web Push/VAPID sends server-scheduled reminders while the app is closed when the API is online and the device has an active subscription; actual delivery still depends on host uptime, HTTPS, browser support, and permission. The 1 AM routine day key now feeds routine analytics from the client; workout session dates remain workout calendar dates.
- **Intentionally excluded:** Cross-device cloud sync and backup export/restore. Backup import UI/API was removed from the user flow; previously imported MongoDB records remain intact.
- **Removed from the user flow:** Backup import UI/API. The supplied workout records remain in MongoDB.

### Phone workflow handoff — 2026-10-18

- Added an install prompt with browser install support and iOS Safari home-screen instructions.
- Added phone-friendly Workout Stats tabs (Summary, Overview, Volume, History, PRs) and exercise detail pages with load charts, session sets, and estimated 1RM.
- Added Routine and Analytics tabs with 14-day completion view, daily heatmap, and activity streak.
- Added a reminder center to the mobile header; scheduled task reminders can be opened directly in the routine. Wellness and reminder controls are available from Profile.
- Analytics date ranges now use the client's IronTrack date key so the server doesn't interpret the 1 AM boundary in its own timezone.
- The application has no automatic multi-device sync. To use it on a phone, deploy the frontend over HTTPS and point it at the deployed API; see [phone workflow and deployment](docs/phone-workflow.md).

### Remaining before production use

1. Deploy the API and frontend, set private environment variables in the hosting dashboard, and verify the Atlas network allowlist.
2. Replace the temporary allow-all CORS setting with the exact deployed frontend origin before serving real accounts.
3. Configure the API host's VAPID environment variables and enable notifications from each installed phone/browser. Keep the VAPID private key secret.

## 2026-11-02 — Workout session review

- Added opt-in Auto progression: after logging the last set for an exercise, the next exercise becomes active when its rest countdown ends. Logging a set still requires a deliberate tap; the browser cannot detect repetitions.
- Added optional spoken exercise/set announcements and repeating tempo counts. Voice stops while resting or paused and requires browser speech support.
- Skipping an exercise now preserves completed sets and allows a partially completed session to be saved without logging skipped sets.
- Hardened workout API validation for real calendar dates and history limits, and made duplicate concurrent log retries idempotent.
- Prayer reminders now have timezone coverage for both summer and winter offsets, including dates that cross UTC midnight.
- Isolated the routine's one-second clock from the task-list render path; only the active timed task card runs a separate interval, with cleanup on deactivation/unmount.
- Audited React-owned timers, browser listeners, and GSAP context cleanup. Removed the repository's Docker/Compose packaging; source-mode API deployment requires externally provisioned MongoDB.
- Updated the phone guide, architecture map, tooling notes, roadmap, and improvement priorities to match the shipped offline queue and workout behavior.

## Account deletion readiness

- Added a password-verified, exact-`DELETE` confirmation flow to Settings and an authenticated, rate-limited API endpoint.
- The server removes account-owned data and task-linked routine completions in a single awaited MongoDB transaction. A failure aborts the transaction; success is not returned before the cascade commits.
- Access tokens on other devices are rejected once the account record is gone. The client clears the account query cache, offline queue, active workout/timer state, and local preferences after deletion.
- Transaction-backed features require a MongoDB replica set or sharded cluster; see [account authentication](docs/auth-security.md) and [the production checklist](docs/roadmap.md).

## 2026-11-02 — Routine timing, rollover, and workout navigation

- Routine task creation now defaults to 45 minutes, calculates the end time from the chosen start and duration, and rejects times outside the configured prayer interval. Client and API validation also reject overlapping tasks and out-of-order prayer anchors.
- The routine date advances at 1:00 AM local time without a manual reset button. An open app checks on an interval and when returning to the foreground; manually selected dates are preserved.
- The workout day strip scrolls horizontally, including in schedule-edit mode. Workout names remain free-form and browser autocomplete suggestions are disabled for inline inputs.
- Kept workout Auto progression opt-in after rest and voice coaching optional; targeted tests cover progression timing and voice cancellation on pause.
- Reconstructed two files that had been found containing NUL bytes and verified both are clean. The root `context.md` now documents current behavior and deployment caveats.
- Email verification and password recovery use expiring single-use tokens and direct SMTP delivery from the API. Redis, BullMQ, and the separate email worker have been removed. Unit tests cover the auth/session response handling and direct SMTP call; live delivery still requires valid provider configuration.
- `client/index.html` is an app shell and loads React, which imports `client/src/styles.css`; a rendered browser check is needed to validate computed styling.
- 2026-11-02 validation: `npm run build` passed and `npm test` passed (server: 13 files / 52 tests; client: 21 files / 67 tests). The source HTML audit found only the React app shell; live SMTP delivery and rendered-browser styling remain unverified. Changes remain local and unpushed.

## 2026-11-02 — Mobile workout and routine polish

- Reworked workout-day edit cards so Change workout and Assign workout remain inside each day card with usable touch targets; manual assignment stays explicit and no workout is auto-assigned or suggested.
- Added the workout-name editor to the overview title. Saving the inline field updates the current draft and closes the input; the page-level Save changes action persists that plan to the API and updates cached app data.
- Reflowed routine analytics metrics to two columns on mobile, added a shared selectable reporting period, and connected routine event history to period-aware pagination with cached pages and per-section retry/error states.
- Corrected stale analytics requests that used unsupported day-count query parameters.
- Mobile browser review at the 409 px app width confirmed both screens fit without the prior overflowing workout control or compressed metric row.
- Verification: server 16 files / 61 tests passed; client 21 files / 70 tests passed; production builds passed; `npm audit --omit=dev` found zero vulnerabilities. A later full build is required after the final overview-title editor adjustment.
