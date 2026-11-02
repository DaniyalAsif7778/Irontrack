# IronTrack next improvements

Status: approved by the product owner on 2026-10-20; current progress reviewed on 2026-11-02. Keep account data private, keep task start times manually controlled, preserve the fixed five prayer anchors, and do not reintroduce import/export or social features.

## Design direction

- Palette: the existing near-black canvas, blue action color, teal progress color, soft white text, and muted slate copy.
- Type: Inter with the existing system fallbacks. Keep page copy readable and concise.
- Public page layout: a left-aligned promise and direct sign-up/sign-in actions paired with a compact five-anchor prayer timeline. Follow with specific product capabilities and a privacy statement; stack cleanly on mobile.
- Product principles: make the prayer-day rhythm the memorable visual; no leaderboard, public data, generic SaaS metric wall, or external prayer-time API.

## Phases

### 1. Public product page and search visibility — complete

- Show a public product page at `/` while signed out; preserve the signed-in home screen at `/`.
- Keep private routes behind sign-in, with sign-up and sign-in links from the product page.
- Use the existing static social metadata, favicon, and share image; keep the sitemap to the public root.
- Verify unauthenticated root and private routes, authenticated root, responsive rendering, and production build.

### 2. Fixed prayer anchors and schedule preview — complete

- Add optional manual reference times for Fajr, Dhuhr, Asr, Maghrib, and Isha to account preferences; do not call a prayer-time service.
- Use configured times when deciding which fixed prayer card a delayed task crosses into; retain the current task-based anchor fallback for existing accounts.
- Add a read-only preview that simulates a chosen delay from a chosen scheduled task, showing moved tasks and prayer-card changes without mutating saved schedules.

### 3. Offline recovery for safe actions — complete

- Show network/sync state and persist only idempotent routine-completion and workout-log saves while offline.
- Do not queue task deletion, schedule replacement, snooze, extension, or other operations that could invalidate the user's later work.
- Replay queued actions in order when online, deduplicate retries, expose failures for manual resolution, and scope queued records by account.
- Keep workout sessions in local draft storage and make a failed final workout save recoverable.
- Weight, wellness, settings, schedule, and plan edits still require a live API connection; the queue is not cross-device sync.

### 4. Weekly review — complete

- Summarize routine completion, workout frequency/volume, wellness check-ins, and schedule delays from existing persisted data.
- Show a small number of transparent observations and let the user choose a next-week adjustment; do not change the schedule automatically.

### 5. Accessibility and release verification — in progress

- Review keyboard focus/order, screen-reader names/status, contrast, text zoom/reflow, and mobile target size across the app.
- Add focused tests for new flows; run the complete client/server suite and production builds; review the exact diff and push the completed branch.

## Handoff log

- 2026-10-20: Phase 1 added the public signed-out home, preserved signed-in app home, and added auth-route tests.
- 2026-10-20: Phase 2 added account prayer anchors, persistence/validation, a schedule delay preview, and matching configured-anchor plus midnight/cutoff behavior in server task shifting.
- 2026-10-20: Phase 3 added an account-scoped foreground sync queue for routine completion and workout logs; workout log retries now carry an idempotency key. Other mutations are intentionally not queued.
- 2026-10-20: Phase 4 added weekly activity counts and a user-selected local next-week focus. It never edits schedules automatically.
- 2026-10-20: Phase 5 is running type checks, tests, responsive/focus review, and release diff review before push.
- 2026-11-02: Workout review added opt-in Auto progression after a logged set's rest period, spoken exercise/set and tempo cues, and the ability to finish after skipping remaining sets. Workout logs now reject impossible calendar dates and malformed history limits, return a concurrent duplicate retry as the original log, and allow database errors to reach the server error handler rather than mislabeling them as invalid requests.

## Workout review — 2026-11-02

The session is still user-controlled: Auto does not detect or log completed reps. The lifter records each set with **Done**; Auto then handles the rest-to-next-exercise transition. Voice coach is optional and uses the exercise tempo (for example, `3-1-2`) to repeat lowering, hold, and lifting counts during a set. Both controls are stored with the in-progress session on that device.

### Next workout improvements

- **P1 — Correct a saved session:** add an authenticated, owner-scoped way to correct or delete a mistaken log and ensure analytics/history refresh without risking a second completion.
- **P2 — Adapt on the gym floor:** allow a one-session exercise substitution or reorder when equipment is occupied, without mutating the saved plan.
- **P2 — Broaden progression:** support per-set rest and tempo prescriptions, and explain how logged reps/load affect personal-best estimates.
- **P3 — Better session notes:** let a lifter add a short note (pain, equipment, or form reminder) without making notes required to finish.

Keep these separate from automatic rep recognition; the browser cannot reliably detect completed repetitions without additional hardware.
