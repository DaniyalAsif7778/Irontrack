# Implementation progress

For phase sequencing, production setup, and next-agent handoff, read [docs/roadmap.md](docs/roadmap.md).

## Upgrade phases

### Phase 1 — Responsive PWA foundation (complete)

- Reworked the app shell for a fixed desktop sidebar and mobile bottom navigation with safe-area spacing.
- Added an install manifest, app icon, production service-worker registration, and cached app shell/build assets.
- Kept backup import reachable on both layouts and added an actionable API connection error.
- The shell and assets load offline after a prior visit; data edits still require the API. Offline write queue and account sync remain future phases.

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
- Kept local demo mode available when `VITE_API_URL` is not configured.
- Added `AUTH_JWT_SECRET` configuration guidance plus server session/validation and frontend form validation tests.
- Verified both production TypeScript/Vite builds and both workspace test suites.

### Phase 5 — Settings and personalization (complete)

- Added a responsive Settings page for account display name, default weight unit, focus length, break length, and browser notification permission.
- Saved account preferences to MongoDB and exposed them through the authenticated account session.
- Applied the weight-unit preference to new logs and normalized mixed-unit analytics trends into the selected unit.
- Focus and break lengths apply to newly started timers; an active timer keeps the durations it started with. Timer state is kept separate per account on a shared device.
- Added a local-demo preference path and validation coverage for settings.

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

Local API runs on port 4001 with MongoDB-backed account authentication. The current Vite page on port 5174 defaults to that API even if its process started before `.env` was configured. The corrected workout export was imported without overwriting existing records: 4 plans, 5 sessions, and 15 progression records. The corrected routine backup has no routine tasks or weight records. The routine screen now explains that and offers a first-task action. The imported workout plans and session history are visible in the app.

## 2026-09-26 update
- MongoDB connection configuration added locally (credentials are stored only in ignored server/.env).
- Client now targets the local Express API through ignored client/.env; existing backup data will be imported into MongoDB.

## 2026-10-18 — Reference audit and interaction pass

- Kept the reference theme tokens and made the desktop shell slimmer; mobile now shows four primary destinations and a compact More menu for Weight, Schedules, and Settings.
- Added GSAP page transitions and ScrollTrigger reveals for top-level page sections. Motion is skipped when the OS requests reduced motion.
- Active workouts now support pause/resume and an explicit End action with a discard confirmation. Pausing freezes workout and rest timers. Previous session reps and load prefill matching exercises to reduce repeated entry; saved duration excludes paused time.
- Removed the user-facing backup import control and API route per the product direction. Data already imported into MongoDB is unchanged. Cloud sync and export/restore are intentionally excluded.

### Reference coverage

- **Implemented:** PPL plan and high-rep days, exercise plan editor, persisted workout sessions with pause/resume/end, set logging and rest timer, workout history, five workout analytics tabs, exercise history and estimated PRs, prayer-anchored tasks/subtasks and persistent timer, routine completion analytics, schedule management, body-weight logging/trend, water and movement check-ins, reminder settings and upcoming reminder center, account/preferences, responsive PWA shell, install guidance, and service-worker app-shell caching.
- **Partial:** The PWA shell can load after a prior visit, but server-backed changes need a network connection; there is no offline write queue. Web Push/VAPID now sends server-scheduled reminders while the app is closed when the API is online and the device has an active subscription; actual delivery still depends on host uptime, HTTPS, browser support, and permission. The 1 AM routine day key now feeds routine analytics from the client; workout session dates remain workout calendar dates.
- **Intentionally excluded:** Cross-device cloud sync and backup export/restore. Backup import UI/API was removed from the user flow; previously imported MongoDB records remain intact.
- **Removed from the user flow:** Backup import UI/API. The supplied workout records remain in MongoDB.

### Phone workflow handoff — 2026-10-18

- Added an install prompt with browser install support and iOS Safari home-screen instructions.
- Added phone-friendly Workout Stats tabs (Summary, Overview, Volume, History, PRs) and exercise detail pages with load charts, session sets, and estimated 1RM.
- Added Routine and Analytics tabs with 14-day completion view, daily heatmap, and activity streak.
- Added a reminder center to the mobile header; scheduled task reminders can be opened directly in the routine. Wellness and reminder controls remain available under More → Wellness.
- Analytics date ranges now use the client's IronTrack date key so the server doesn't interpret the 1 AM boundary in its own timezone.
- The application has no automatic multi-device sync. To use it on a phone, deploy the frontend over HTTPS and point it at the deployed API; see [phone workflow and deployment](docs/phone-workflow.md).

### Remaining before production use

1. Deploy the API and frontend, set private environment variables in the hosting dashboard, and verify the Atlas network allowlist.
2. Replace the temporary allow-all CORS setting with the exact deployed frontend origin before serving real accounts.
3. Add an offline write queue if edits must be saved without the API network connection.
4. Configure the API host's VAPID environment variables and enable notifications from each installed phone/browser. Keep the VAPID private key secret.
