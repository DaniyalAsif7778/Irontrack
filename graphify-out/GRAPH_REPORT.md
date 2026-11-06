# Graph Report - irontrack  (2026-11-06)

## Corpus Check
- 176 files · ~96,887 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 4, (none) 1, .webmanifest 1)

## Summary
- 1157 nodes · 2688 edges · 59 communities (50 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `50322bb2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.controller.ts
- workout.service.ts
- push.service.ts
- database-load.mjs
- ref_vitest
- TaskDialog.tsx
- server/package.json
- fail
- react
- NotificationScheduler.tsx
- WorkoutPage.tsx
- offlineQueue.ts
- WeightPage.tsx
- routine.service.ts
- SettingsPage.tsx
- ironToday
- HomePage.tsx
- Workout
- dependencies
- dependencies
- app.ts
- client/package.json
- db.ts
- WorkoutStatsPage.tsx
- compilerOptions
- generate-showcase.mjs
- components.json
- notifications.controller.ts
- NotificationScheduler.tsx
- AuthGate.tsx
- Button.tsx
- models
- steps
- models
- App.tsx
- types.ts
- userSimulation.spec.js
- compilerOptions
- app.ts
- readWorkoutNameSuggestions
- performance-alerts.service.ts
- WorkoutPage.test.tsx
- tempoParts
- compilerOptions
- scripts
- errorHandler.ts
- toStoredWeight
- scripts
- wellness.model.ts
- auth.service.ts
- express.d.ts
- vercel.json
- @testing-library/jest-dom

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
- `startWorkout()` --calls--> `ironToday()`  [EXTRACTED]
  client/src/pages/workout/WorkoutPage.tsx → client/src/utils/date.ts
- `createApp()` --indirect_call--> `subscribe()`  [INFERRED]
  server/src/tests/notificationOwnership.test.ts → server/src/controllers/notifications/notifications.controller.ts
- `unsubscribe()` --calls--> `fail()`  [EXTRACTED]
  server/src/controllers/notifications/notifications.controller.ts → server/src/middlewares/errorHandler.ts
- `WorkoutLogCursor` --calls--> `isValidDateKey()`  [EXTRACTED]
  server/src/utils/workoutValidation.ts → server/src/utils/dateValidation.ts

## Import Cycles
- None detected.

## Communities (59 total, 9 thin omitted)

### Community 0 - "auth.controller.ts"
Cohesion: 0.05
Nodes (76): jsonwebtoken, jsonwebtoken@^9.0.3, authResponseFloor(), clearSessionCookies(), clientTimezone(), deleteMe, forgotPassword, login (+68 more)

### Community 1 - "workout.service.ts"
Cohesion: 0.06
Nodes (51): listLogs(), putWeek(), saveLog(), saveProgram(), WorkoutLog, estimatedMax(), evaluateWorkoutPerformance(), definitionFromExercise() (+43 more)

### Community 2 - "push.service.ts"
Cohesion: 0.13
Nodes (27): NotificationSchedulerLease, preferencesSchema, PushDelivery, PushSubscription, ScheduledNotification, acquireSchedulerLease(), addDateKey(), claimScheduledNotification() (+19 more)

### Community 3 - "database-load.mjs"
Cohesion: 0.06
Nodes (33): APP_SHELL, useCopySchedule(), useRoutineSchedule(), formatDisplayDate(), getLocalDateKey(), TaskCard(), addSubtask(), toggleSubtask() (+25 more)

### Community 4 - "ref_vitest"
Cohesion: 0.06
Nodes (30): AppEntry(), appPaths, isKnownAppPath(), GlobalErrorBoundary, Props, State, queryClient, authErrorMessage() (+22 more)

### Community 5 - "TaskDialog.tsx"
Cohesion: 0.15
Nodes (18): emptyTask, TaskDialog(), submit(), taskDuration(), prayerTimes, taskSchema, settingsSchema, SettingsValues (+10 more)

### Community 6 - "server/package.json"
Cohesion: 0.09
Nodes (32): supertest, tsx, @types/bcrypt, @types/cookie-parser, @types/cors, @types/express, @types/jsonwebtoken, @types/morgan (+24 more)

### Community 7 - "fail"
Cohesion: 0.07
Nodes (73): Block, blockLabel, BLOCKS, DAY_TYPES, DayType, isBlock(), isDayType(), read() (+65 more)

### Community 8 - "react"
Cohesion: 0.13
Nodes (15): InstallPrompt(), InstallPromptEvent, NotificationCenter(), NavButton(), NavButtonProps, useRoutineDay(), AppShell(), AppShellProps (+7 more)

### Community 9 - "NotificationScheduler.tsx"
Cohesion: 0.10
Nodes (22): clock(), Phase, readTimer(), remaining(), RoutineTimer(), TimerState, defaultReminderPreferences, pushSubscribedKey (+14 more)

### Community 10 - "WorkoutPage.tsx"
Cohesion: 0.11
Nodes (17): activeKey(), ActiveWorkout, DayType, elapsedText(), Exercise, legacyDayLabels, LibraryExercise, numberWords (+9 more)

### Community 11 - "offlineQueue.ts"
Cohesion: 0.19
Nodes (24): OfflineSyncStatus(), actionKey(), activeFlushes, announce(), clearOfflineQueue(), discardOfflineAction(), enqueueOfflineAction(), flushOfflineQueue() (+16 more)

### Community 12 - "WeightPage.tsx"
Cohesion: 0.24
Nodes (9): WeightPage(), WeightFormValues, weightSchema, AnalyticsData, Weight, WellnessDay, WeightTrendPoint, weightTrendPoints() (+1 more)

### Community 13 - "routine.service.ts"
Cohesion: 0.19
Nodes (7): RoutineReminder, listRoutineOccurrences(), assertTaskTimeAvailable(), createTask(), getDay(), RoutineTaskTimeConflictError, updateTask()

### Community 14 - "SettingsPage.tsx"
Cohesion: 0.19
Nodes (11): SettingsPage, AuthSessionEntry, deviceName(), sessionKey, user, AppState, defaultPreferences, Preferences (+3 more)

### Community 15 - "ironToday"
Cohesion: 0.18
Nodes (12): MetricCard(), AnalyticsPage(), EventReview, periodOptions, savedFocus(), renderPage(), WorkoutReviewLog, WorkoutReviewPage (+4 more)

### Community 16 - "HomePage.tsx"
Cohesion: 0.20
Nodes (9): dayKey(), DayType, greeting(), HomePage(), labels, WeekDay, WorkoutLog, WorkoutLogPage (+1 more)

### Community 17 - "Workout"
Cohesion: 0.10
Nodes (5): Workout(), addLibraryExercise(), addNewExercise(), saveExerciseDraft(), startWorkout()

### Community 18 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, axios@^1.20.0, date-fns@^4.4.0, gsap@^3.15.0, @hookform/resolvers@^5.9.2, lucide-react@^1.43.0, react@^18.3.1, react-dom@^18.3.1 (+13 more)

### Community 19 - "dependencies"
Cohesion: 0.13
Nodes (15): cookie-parser, express-mongo-sanitize, helmet, nodemailer, web-push, dependencies, cookie-parser@^1.4.7, express@^4.21.2 (+7 more)

### Community 20 - "app.ts"
Cohesion: 0.15
Nodes (14): express, express-rate-limit, express-rate-limit@^8.7.1, asyncHandler(), errorHandler(), accountDeletionLimiter, emailLimiter, registrationLimiter (+6 more)

### Community 21 - "client/package.json"
Cohesion: 0.08
Nodes (36): devDependencies, autoprefixer@^10.5.5, fake-indexeddb@^6.2.7, jsdom@^30.1.3, postcss@^8.5.28, tailwindcss@^3.4.17, tailwindcss-animate@^1.0.7, @tanstack/react-query-devtools@^5.104.4 (+28 more)

### Community 22 - "db.ts"
Cohesion: 0.20
Nodes (8): configuredSlowQueryMs, connectDatabase(), dropLegacyIndex(), ensureNotificationAndWorkoutHistoryIndexes(), ensureRoutineEventTimelineIndex(), monitorDatabaseCommands(), monitoredClients, WeightLog

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

### Community 28 - "NotificationScheduler.tsx"
Cohesion: 0.24
Nodes (11): alreadySent(), markSent(), NotificationScheduler(), notify(), sentKey(), Session, SessionPage, WeekDay (+3 more)

### Community 29 - "AuthGate.tsx"
Cohesion: 0.18
Nodes (14): sonner@^2.0.8, AuthGate(), signOut(), AuthPage, isAuthUser(), SessionContext, SessionContextValue, sessionKey (+6 more)

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
Cohesion: 0.07
Nodes (8): AnalyticsPage, App(), ExerciseDetailPage, ExerciseDetailPage(), Session, SessionPage, Stat(), recharts

### Community 35 - "types.ts"
Cohesion: 0.12
Nodes (28): queryKeys, useAnalytics(), useRoutineEventAnalytics(), useRoutineMutations(), useWeightLogs(), useWeightMutations(), useWellness(), api() (+20 more)

### Community 36 - "userSimulation.spec.js"
Cohesion: 0.20
Nodes (10): devDependencies, concurrently@^9.1.2, name, private, scripts, build, dev, test (+2 more)

### Community 37 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 38 - "app.ts"
Cohesion: 0.18
Nodes (8): cors, morgan, cors@^2.8.5, morgan@^1.12.1, allowedOrigins, apiLimiter, app, configuredOrigins

### Community 39 - "readWorkoutNameSuggestions"
Cohesion: 0.40
Nodes (5): readWorkoutNameSuggestions(), chooseWorkoutName(), saveWorkoutNameSuggestion(), updateWeekAssignment(), workoutNameSuggestionsKey()

### Community 40 - "performance-alerts.service.ts"
Cohesion: 0.22
Nodes (10): RoutineCompletion, RoutineEvent, RoutineTask, RoutineTaskOccurrence, subtaskSchema, dateKeyInTimezone(), evaluateMissedWorkoutNudge(), LoggedWorkout (+2 more)

### Community 41 - "WorkoutPage.test.tsx"
Cohesion: 0.20
Nodes (7): { api }, exercise, library, MockSpeechSynthesisUtterance, plan, week, weekdays

### Community 42 - "tempoParts"
Cohesion: 0.40
Nodes (5): spokenCount(), tempoCountCues(), tempoParts(), startRepTimer(), updateTempoPhase()

### Community 43 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 44 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, load:db, load:smoke, start, test

### Community 45 - "errorHandler.ts"
Cohesion: 0.19
Nodes (9): dotenv, pino, dotenv@^16.4.7, pino@^10.4.0, connectWhenAvailable(), httpServer, port, startNotificationScheduler() (+1 more)

### Community 46 - "toStoredWeight"
Cohesion: 0.67
Nodes (3): toStoredWeight(), editSet(), updateDraftSet()

### Community 47 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, test:watch

### Community 48 - "wellness.model.ts"
Cohesion: 0.38
Nodes (4): WellnessLog, wellnessSchema, listWellness(), recentDates()

### Community 52 - "auth.service.ts"
Cohesion: 0.11
Nodes (22): bcrypt, mongoose, bcrypt@^6.0.0, AuthChallenge, AuthChallengePurpose, PrayerTimes, PublicUser, UserFields (+14 more)

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mongoose` connect `auth.service.ts` to `auth.controller.ts`, `workout.service.ts`, `push.service.ts`, `database-load.mjs`, `app.ts`, `server/package.json`, `performance-alerts.service.ts`, `fail`, `errorHandler.ts`, `wellness.model.ts`, `dependencies`, `db.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `api()` (e.g. with `AuthGate.test.tsx` and `offlineQueue.test.ts`) actually correct?**
  _`api()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `auth.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05239240844693932 - nodes in this community are weakly interconnected._
- **Why does `api()` connect `types.ts` to `App.tsx`, `database-load.mjs`, `ref_vitest`, `react`, `NotificationScheduler.tsx`, `WorkoutPage.tsx`, `offlineQueue.ts`, `WorkoutPage.test.tsx`, `SettingsPage.tsx`, `ironToday`, `HomePage.tsx`, `Workout`, `WorkoutStatsPage.tsx`, `NotificationScheduler.tsx`, `AuthGate.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `workout.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05548654244306418 - nodes in this community are weakly interconnected._
- **Why does `Workout()` connect `Workout` to `types.ts`, `readWorkoutNameSuggestions`, `WorkoutPage.test.tsx`, `WorkoutPage.tsx`, `offlineQueue.ts`, `tempoParts`, `toStoredWeight`, `ironToday`, `NotificationScheduler.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `push.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12903225806451613 - nodes in this community are weakly interconnected._