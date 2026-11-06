# Graph Report - irontrack  (2026-11-06)

## Corpus Check
- 176 files · ~97,031 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 4, (none) 1, .webmanifest 1)

## Summary
- 1158 nodes · 2689 edges · 69 communities (57 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f732f3c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- requireAuth.ts
- workout.service.ts
- push.service.ts
- ScheduleManager.tsx
- ref_vitest
- TaskDialog.tsx
- server/package.json
- fail
- react
- NotificationScheduler.tsx
- auth.controller.ts
- offlineQueue.ts
- WeightPage.tsx
- routine.service.ts
- SettingsPage.tsx
- AnalyticsPage.tsx
- database-load.mjs
- Workout
- dependencies
- dependencies
- app.ts
- client/package.json
- auth.service.ts
- WorkoutStatsPage.tsx
- compilerOptions
- generate-showcase.mjs
- components.json
- notifications.controller.ts
- ironToday
- workout.controller.ts
- Button.tsx
- models
- steps
- models
- App.tsx
- types.ts
- userSimulation.spec.js
- compilerOptions
- app.ts
- email.service.ts
- performance-alerts.service.ts
- WorkoutPage.test.tsx
- workout.model.ts
- compilerOptions
- scripts
- errorHandler.ts
- workoutValidation.ts
- scripts
- wellness.model.ts
- TaskCard.tsx
- AuthPage
- auth.ts
- user.model.ts
- express.d.ts
- settings.ts
- vercel.json
- notification.model.ts
- workoutData.ts
- PrayerTimes
- workoutLogPagination.test.ts
- accountDeletion.test.ts
- jsdom@^30.1.3
- @types/react@^18.3.18

## God Nodes (most connected - your core abstractions)
1. `api()` - 54 edges
2. `fail()` - 52 edges
3. `Workout()` - 42 edges
4. `ironToday()` - 31 edges
5. `react` - 29 edges
6. `App()` - 26 edges
7. `@tanstack/react-query` - 25 edges
8. `react-router-dom` - 23 edges
9. `lucide-react` - 23 edges
10. `routeParam()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `updatePreference()` --calls--> `api()`  [EXTRACTED]
  client/src/pages/settings/ReminderSettings.tsx → client/src/lib/api/api.ts
- `revokeSession()` --calls--> `api()`  [EXTRACTED]
  client/src/pages/settings/SettingsPage.tsx → client/src/lib/api/api.ts
- `toggleNotifications()` --calls--> `api()`  [EXTRACTED]
  client/src/pages/settings/SettingsPage.tsx → client/src/lib/api/api.ts
- `startWorkout()` --calls--> `ironToday()`  [EXTRACTED]
  client/src/pages/workout/WorkoutPage.tsx → client/src/utils/date.ts
- `createApp()` --indirect_call--> `subscribe()`  [INFERRED]
  server/src/tests/notificationOwnership.test.ts → server/src/controllers/notifications/notifications.controller.ts

## Import Cycles
- None detected.

## Communities (69 total, 12 thin omitted)

### Community 0 - "requireAuth.ts"
Cohesion: 0.15
Nodes (24): jsonwebtoken, jsonwebtoken@^9.0.3, clearSessionCookies(), cookieBase, REFRESH_AUDIENCE, REFRESH_COOKIE, REFRESH_MAX_AGE, refreshCookieOptions (+16 more)

### Community 1 - "workout.service.ts"
Cohesion: 0.12
Nodes (23): ExerciseLibrary, WorkoutPlan, WorkoutProgram, definitionFromExercise(), ExerciseDefinition, ExerciseReference, legacyExerciseId(), libraryMap() (+15 more)

### Community 2 - "push.service.ts"
Cohesion: 0.17
Nodes (22): acquireSchedulerLease(), addDateKey(), claimScheduledNotification(), configured, dateAtLocalTime(), dayParts(), deliverScheduledNotification(), dispatchDueNotifications() (+14 more)

### Community 3 - "ScheduleManager.tsx"
Cohesion: 0.18
Nodes (16): useCopySchedule(), useRoutineSchedule(), prayerLabels, ScheduleCard(), ScheduleManager(), { useCopySchedule, useRoutineSchedule, mutateAsync }, Schedule, flattenSchedule() (+8 more)

### Community 4 - "ref_vitest"
Cohesion: 0.09
Nodes (27): AppEntry(), appPaths, isKnownAppPath(), AuthGate(), signOut(), AuthPage, isAuthUser(), SessionContext (+19 more)

### Community 5 - "TaskDialog.tsx"
Cohesion: 0.23
Nodes (15): emptyTask, TaskDialog(), submit(), taskDuration(), prayerTimes, Task, calculateEndTime(), prayerOrder (+7 more)

### Community 6 - "server/package.json"
Cohesion: 0.09
Nodes (32): supertest, tsx, @types/bcrypt, @types/cookie-parser, @types/cors, @types/express, @types/jsonwebtoken, @types/morgan (+24 more)

### Community 7 - "fail"
Cohesion: 0.07
Nodes (70): Block, blockLabel, BLOCKS, DAY_TYPES, DayType, isBlock(), isDayType(), read() (+62 more)

### Community 8 - "react"
Cohesion: 0.17
Nodes (9): InstallPrompt(), InstallPromptEvent, NavButton(), NavButtonProps, AppShell(), AppShellProps, AppView, lucide-react (+1 more)

### Community 9 - "NotificationScheduler.tsx"
Cohesion: 0.10
Nodes (22): clock(), Phase, readTimer(), remaining(), RoutineTimer(), TimerState, defaultReminderPreferences, pushSubscribedKey (+14 more)

### Community 10 - "auth.controller.ts"
Cohesion: 0.14
Nodes (25): clearSessionCookies(), clientTimezone(), deleteMe, login, logout, me, refresh, requestMetadata() (+17 more)

### Community 11 - "offlineQueue.ts"
Cohesion: 0.19
Nodes (24): OfflineSyncStatus(), actionKey(), activeFlushes, announce(), clearOfflineQueue(), discardOfflineAction(), enqueueOfflineAction(), flushOfflineQueue() (+16 more)

### Community 12 - "WeightPage.tsx"
Cohesion: 0.26
Nodes (6): WeightPage(), WeightFormValues, weightSchema, Weight, WeightTrendPoint, weightTrendPoints()

### Community 13 - "routine.service.ts"
Cohesion: 0.21
Nodes (6): listRoutineOccurrences(), assertTaskTimeAvailable(), createTask(), getDay(), RoutineTaskTimeConflictError, updateTask()

### Community 14 - "SettingsPage.tsx"
Cohesion: 0.10
Nodes (21): SettingsPage, AuthMode, SentPurpose, sessionKey, profileLinks, ProfilePageProps, AuthSessionEntry, deviceName() (+13 more)

### Community 15 - "AnalyticsPage.tsx"
Cohesion: 0.21
Nodes (9): AnalyticsPage, AnalyticsPage(), EventReview, periodOptions, savedFocus(), renderPage(), WorkoutReviewLog, WorkoutReviewPage (+1 more)

### Community 16 - "database-load.mjs"
Cohesion: 0.12
Nodes (12): APP_SHELL, copy(), date, failures, latencies, levels, record(), request() (+4 more)

### Community 17 - "Workout"
Cohesion: 0.05
Nodes (35): activeKey(), ActiveWorkout, DayType, elapsedText(), Exercise, legacyDayLabels, LibraryExercise, numberWords (+27 more)

### Community 18 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, axios@^1.20.0, date-fns@^4.4.0, gsap@^3.15.0, @hookform/resolvers@^5.9.2, lucide-react@^1.43.0, react@^18.3.1, react-dom@^18.3.1 (+14 more)

### Community 19 - "dependencies"
Cohesion: 0.12
Nodes (17): cookie-parser, dotenv, express-mongo-sanitize, nodemailer, pino, web-push, dependencies, cookie-parser@^1.4.7 (+9 more)

### Community 20 - "app.ts"
Cohesion: 0.15
Nodes (14): express, express-rate-limit, express-rate-limit@^8.7.1, asyncHandler(), errorHandler(), accountDeletionLimiter, emailLimiter, registrationLimiter (+6 more)

### Community 21 - "client/package.json"
Cohesion: 0.08
Nodes (34): devDependencies, autoprefixer@^10.5.5, fake-indexeddb@^6.2.7, postcss@^8.5.28, tailwindcss@^3.4.17, tailwindcss-animate@^1.0.7, @tanstack/react-query-devtools@^5.104.4, @testing-library/dom@^10.4.2 (+26 more)

### Community 22 - "auth.service.ts"
Cohesion: 0.14
Nodes (14): mongoose, verifyEmailAddress, AuthChallenge, AuthChallengePurpose, WeightLog, DUMMY_PASSWORD_HASH, hashToken(), issueChallenge() (+6 more)

### Community 23 - "WorkoutStatsPage.tsx"
Cohesion: 0.15
Nodes (17): WorkoutStatsPage, colors, dateLabel(), DayType, ExerciseLog, formatDuration(), HistoryList(), labels (+9 more)

### Community 24 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+10 more)

### Community 25 - "generate-showcase.mjs"
Cohesion: 0.27
Nodes (13): browser(), card(), esc(), line(), out, rect(), scenes, screenOverview() (+5 more)

### Community 26 - "components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+8 more)

### Community 27 - "notifications.controller.ts"
Cohesion: 0.13
Nodes (19): config(), prefsSchema, status(), subscribe(), subscriptionSchema, test(), timezoneSchema, unsubscribe() (+11 more)

### Community 28 - "ironToday"
Cohesion: 0.10
Nodes (14): App(), NotificationCenter(), alreadySent(), markSent(), NotificationScheduler(), notify(), sentKey(), Session (+6 more)

### Community 29 - "workout.controller.ts"
Cohesion: 0.16
Nodes (9): listLogs(), putWeek(), savePlan(), savePlanExercise(), saveProgram(), workout, WorkoutLogCursor, workoutLogCursor() (+1 more)

### Community 30 - "Button.tsx"
Cohesion: 0.17
Nodes (12): clsx@^2.1.1, @radix-ui/react-slot@^1.5.0, tailwind-merge@^2.6.1, class-variance-authority@^0.7.1, Button(), ButtonProps, buttonStyles, cn() (+4 more)

### Community 31 - "models"
Cohesion: 0.14
Nodes (13): contextLength, maxTokens, models, apiKey, capabilities, defaultCompletionOptions, model, name (+5 more)

### Community 32 - "steps"
Cohesion: 0.14
Nodes (13): jobs, verify, name, on, pull_request, push, run, uses (+5 more)

### Community 33 - "models"
Cohesion: 0.17
Nodes (11): Authorization, models, apiBase, model, name, provider, requestOptions, name (+3 more)

### Community 34 - "App.tsx"
Cohesion: 0.12
Nodes (5): ExerciseDetailPage, ExerciseDetailPage(), Session, SessionPage, Stat()

### Community 35 - "types.ts"
Cohesion: 0.15
Nodes (25): queryKeys, useAnalytics(), useRoutineDay(), useRoutineEventAnalytics(), useRoutineMutations(), useWeightLogs(), useWeightMutations(), useWellness() (+17 more)

### Community 36 - "userSimulation.spec.js"
Cohesion: 0.20
Nodes (10): devDependencies, concurrently@^9.1.2, name, private, scripts, build, dev, test (+2 more)

### Community 37 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 38 - "app.ts"
Cohesion: 0.15
Nodes (10): cors, helmet, morgan, cors@^2.8.5, helmet@^8.3.0, morgan@^1.12.1, allowedOrigins, apiLimiter (+2 more)

### Community 39 - "email.service.ts"
Cohesion: 0.24
Nodes (12): authResponseFloor(), forgotPassword, resendVerification, AuthEmailKind, buildAuthEmail(), clientUrl(), deliverAuthEmail(), EmailDeliveryError (+4 more)

### Community 40 - "performance-alerts.service.ts"
Cohesion: 0.18
Nodes (14): RoutineCompletion, RoutineEvent, RoutineReminder, RoutineTask, RoutineTaskOccurrence, subtaskSchema, dateKeyInTimezone(), estimatedMax() (+6 more)

### Community 41 - "WorkoutPage.test.tsx"
Cohesion: 0.12
Nodes (15): dayKey(), DayType, greeting(), HomePage(), labels, WeekDay, WorkoutLog, WorkoutLogPage (+7 more)

### Community 42 - "workout.model.ts"
Cohesion: 0.16
Nodes (12): saveLog(), loggedExerciseSchema, loggedSetSchema, planExerciseSchema, WORKOUT_WEEKDAY_LABELS, WORKOUT_WEEKDAYS, WorkoutLog, WorkoutProgression (+4 more)

### Community 43 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 44 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, load:db, load:smoke, start, test

### Community 45 - "errorHandler.ts"
Cohesion: 0.21
Nodes (12): configuredSlowQueryMs, connectDatabase(), dropLegacyIndex(), ensureNotificationAndWorkoutHistoryIndexes(), ensureRoutineEventTimelineIndex(), monitorDatabaseCommands(), monitoredClients, connectWhenAvailable() (+4 more)

### Community 46 - "workoutValidation.ts"
Cohesion: 0.36
Nodes (10): sevenDayWeek, exerciseDefinitionPayload(), ExerciseLibraryPayload, isPlanId(), workoutExercisePayload(), workoutPlanDataPayload(), workoutPlanPayload(), WorkoutProgramPayload (+2 more)

### Community 47 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, test:watch

### Community 48 - "wellness.model.ts"
Cohesion: 0.38
Nodes (4): WellnessLog, wellnessSchema, listWellness(), recentDates()

### Community 49 - "TaskCard.tsx"
Cohesion: 0.31
Nodes (7): formatDisplayDate(), getLocalDateKey(), TaskCard(), addSubtask(), toggleSubtask(), TaskCardProps, task()

### Community 50 - "AuthPage"
Cohesion: 0.36
Nodes (7): authErrorMessage(), AuthPage(), resendVerification(), saveNewPassword(), submit(), LocationProbe(), renderAuth()

### Community 51 - "auth.ts"
Cohesion: 0.32
Nodes (6): AuthValues, forgotPasswordSchema, loginSchema, LoginValues, registerSchema, RegisterValues

### Community 52 - "user.model.ts"
Cohesion: 0.14
Nodes (14): bcrypt, bcrypt@^6.0.0, register, updateMe, PrayerTimes, PublicUser, toPublicUser(), UserFields (+6 more)

### Community 54 - "settings.ts"
Cohesion: 0.29
Nodes (4): TaskFormValues, taskSchema, settingsSchema, SettingsValues

### Community 61 - "notification.model.ts"
Cohesion: 0.33
Nodes (5): NotificationSchedulerLease, preferencesSchema, PushDelivery, PushSubscription, ScheduledNotification

### Community 62 - "workoutData.ts"
Cohesion: 0.33
Nodes (5): Exercise, ExerciseSet, legacyWorkoutNames, legacyWorkoutWeek, WorkoutDay

### Community 63 - "PrayerTimes"
Cohesion: 0.50
Nodes (3): PrayerTimes, prayerLabels, prayersDueAt()

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Workout()` connect `Workout` to `offlineQueue.ts`, `WorkoutPage.test.tsx`, `types.ts`, `ironToday`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `api()` (e.g. with `AuthGate.test.tsx` and `offlineQueue.test.ts`) actually correct?**
  _`api()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `requireAuth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1455026455026455 - nodes in this community are weakly interconnected._
- **Why does `api()` connect `types.ts` to `App.tsx`, `ScheduleManager.tsx`, `ref_vitest`, `WorkoutPage.test.tsx`, `NotificationScheduler.tsx`, `offlineQueue.ts`, `SettingsPage.tsx`, `AnalyticsPage.tsx`, `Workout`, `AuthPage`, `WorkoutStatsPage.tsx`, `ironToday`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `workout.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12433862433862433 - nodes in this community are weakly interconnected._
- **Why does `express` connect `app.ts` to `requireAuth.ts`, `app.ts`, `server/package.json`, `fail`, `auth.controller.ts`, `errorHandler.ts`, `dependencies`, `notifications.controller.ts`, `workout.controller.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `ref_vitest` be split into smaller, more focused modules?**
  _Cohesion score 0.08599033816425121 - nodes in this community are weakly interconnected._