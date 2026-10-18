# IronTrack — Project Context

Last updated: 2026-09-26

## Current stage

**MVP persistence is operational.** The React/Vite client calls the local Express API, which is connected to MongoDB Atlas. The supplied IronTrack backup has been imported.

## Completed

- Prayer-anchored routine UI: fixed Fajr, Dhuhr, Asr, Maghrib, and Isha cards remain the product’s primary organizing idea.
- Separate weekday/weekend task schedules, task CRUD, daily completion records, daily progress, and task metadata.
- Body-weight log CRUD, current-weight card, local backup import, Home, and Analytics screens.
- Dark token-based UI, Inter typography, responsive layout, and Lucide icons.
- MongoDB collections: `RoutineTask`, `RoutineCompletion`, and `WeightLog`.
- Backup import result: 6 routine tasks, 2 completion records, and 1 body-weight log.

## Current technical choices

- The normal `mongodb+srv` resolver is refused by Node DNS on this computer. `server/.env` therefore uses the equivalent Atlas multi-host URI, with TLS, replica-set, and authentication settings. The cluster/API connection is healthy.
- `server/.env` and `client/.env` are ignored. No credentials are recorded in this file.
- The client still has a local-storage adapter for offline/temporary development, but the configured app currently uses the API.

## Known gaps / pending work

1. Add a schedule-management screen to deliberately copy or customize weekday and weekend routines.
2. Add a 7/14/30-day analytics endpoint and charts for completion consistency and weight trend.
3. Add prayer-time data only after selecting a privacy policy, location input, calculation method, and notification preference.
4. Add authentication before sharing the app or supporting more than one user.
5. Add API integration tests against an isolated MongoDB database, error reporting, deployment configuration, and backups.

## Product direction from research

- Keep the five prayer cards as stable daily anchors, then place tasks in the interval after each prayer. Current Muslim planning products use this exact “life around Salah” framing.
- Make the next action exceptionally clear: one current prayer card, a small progress indicator, and one-tap completion. Avoid a generic calendar-first layout.
- Keep body-weight logging fast and neutral; surface a rolling trend rather than reacting strongly to day-to-day changes. Research consistently links more frequent digital self-monitoring with better weight-management outcomes, while not proving a universal ideal frequency.
- Later add an optional “after [prayer], I will [task]” plan field for high-priority habits, rather than adding gamification first. This supports cue-based planning without disrupting the prayer-card design.
- Preserve a calm, privacy-first experience: no ads, no social feed, and no forced location collection.

## Security note

The database credential is only in ignored local configuration. Since it was sent in chat, rotate that MongoDB database-user password in Atlas after this setup, then replace the value in `server/.env`.
