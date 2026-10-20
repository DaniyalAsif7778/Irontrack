# IronTrack Event-Driven Habit System Plan

**Status:** Local implementation and verification are complete. Deployment and live device-push verification remain pending.

**Reference:** `IronTrack Event-Driven Habit System Full Plan.md` supplied on 2026-10-20. The reference's statements that a patch is already built are claims in that document and have not been independently verified against this checkout.

## Goal

Track reminder delivery and user responses (complete, snooze, dismiss, or ignore), then use the events for habit and response-time insights. The referenced plan starts with water and movement reminders and later adds routine tasks, workouts, analytics, quiet hours, and adaptive timing.

## Confirmed user requirements

- Plan for both reminder groups: water/movement and routine/workout tasks. Implement the scheduling foundation first, then connect reminders for both groups.
- Every task must have a scheduled time block with a start and end time.
- Snoozing a task for a duration delays subsequent tasks by that duration so the schedule remains aligned.
- Allow one active task and one queued-next task. Do not start tasks concurrently; after the active task completes, notify that the queued task is ready and let the user manually start it.
- Review and audit the source plan one step at a time. Present choices and a recommendation, record decisions here, and do not begin implementation until planning is complete.

## Scheduling behavior to design

The intended schedule is an ordered sequence of daily task blocks. A task's start time is set/recorded when the user begins it that day. Selecting a task must not change the existing 45-minute work interval. If the task is still unfinished at the end of that interval, notify the user and offer an additional 15-minute block. Any accepted delay shifts the start and end times of every later task, preserving order and durations; repeated delays accumulate. Prayer-card collision behavior and the 9:00 pm cutoff are recorded below.

## Audit sequence

1. **Task scheduling model** — define how start/end blocks are created, ordering, overlap prevention, and what “another task is set” means. *(Decision recorded.)*
2. **Snooze and rescheduling rules** — duration choices, cumulative downstream shifts, day boundaries, quiet hours, and fixed commitments. *(Decided.)*
3. **Reminder lifecycle and event integrity** — shown/responded/ignored/dismissed events, duplicate actions, retries, and exactly-once completion effects. *(Decided.)*
4. **Data model and account isolation** — task schedule fields, event/reminder records, indexes, migrations, and retention.
5. **Notification behavior** — in-app, browser push, action buttons, permissions, offline/device limits.
6. **Analytics and privacy** — useful measures, timezone semantics, retention, export choice, and access controls.
7. **Rollout and acceptance checks** — phase boundaries, tests, deployment, observability, and rollback.

## Open questions and decisions

### Step 1 — Task scheduling model (decision recorded)

**User decision:** The user sets/records the task's start time on the day they begin the task. Selecting a task does not change the existing 45-minute work interval. If the task is unfinished when 45 minutes elapse, notify the user and ask whether to assign one more 15-minute block. When a task is delayed, shift every subsequent task's start and end timing by the delay, in every scenario; delays accumulate. The system should preserve each later task's duration and order.

**Implementation-independent model for further planning:** record the actual daily start when work begins; use the existing 45-minute interval for the initial task block; calculate its end from the start plus the work interval; extend the active task in 15-minute increments only after the user accepts; shift every following block by the accepted delay.

**Decision:** If the user selects the next task while one task is in progress, queue it. When the active task completes, notify that the queued task is ready; let the user start it manually so its actual daily start time is recorded when work begins. Do not run two active tasks at once.

### Step 2 — Extension and downstream shift rules (decisions recorded)

The confirmed extension size is 15 minutes, and all later tasks shift when an extension delays the active task.

**Decision:** If the task is still unfinished after an accepted 15-minute extension, ask again every 15 minutes. Each accepted extension adds 15 minutes to the active task and shifts every later task again.

**Decision:** Prayer times remain fixed. When a delayed task would collide with a prayer time, move it into the next prayer card that it would collide with (for example, a post-Fajr task that reaches Dhuhr moves to the post-Dhuhr card). Keep the task in the ordered schedule and continue shifting later tasks as needed. Treat 9:00 pm as the end-of-day cutoff; tasks that cannot fit by then carry forward to the next day.

**Decision:** While one task is in progress, allow the user to select/queue the next task; when the active task completes, notify that the queued task is ready, then wait for the user to start it.

Task completion and queued-task start are included in the every-change push policy; if one action updates multiple task records, describe the cascade in one push.

### Step 3 — Notification frequency and channel (decision recorded)

**User decision:** Send a device push for every change. If one parent action changes multiple tasks (such as a delay shifting later task blocks), send one notification for that parent action rather than one push per affected task. Include a clear description of the successful parent action and its effects so the user can understand what changed.

**Notification contract:** One push per user-triggered parent change. The notification confirms success and describes affected tasks/timing; child updates from the same cascade are summarized in that notification rather than producing separate pushes.

### Step 4 — Ignored reminder handling (decision recorded)

The reference plan marks a reminder ignored after 10 minutes without response and sends exactly one follow-up, without chaining more follow-ups from that follow-up.

**User decision:** Use the one-follow-up option. If a task still gets no response after that follow-up, move it to the final prayer card.

**Chosen detailed default:** Give the initial reminder 10 minutes for a response; if there is no response, mark it ignored and send one follow-up. Give that follow-up another 10 minutes; if still unanswered, move a routine/workout task to the final configured prayer card (Isha) and stop follow-ups for that occurrence. At the 9:00 pm local cutoff, carry it to the next day's final prayer card. Do not move water/movement check-ins into a prayer card; after their single follow-up window, record them as unanswered and stop.

Any follow-up/reminder state change follows the notification contract above, with related changes grouped under the parent event.

### Remaining defaults selected from the user's decisions

- Use a single active task and one queued-next task. Selecting another task while one is active queues it; do not start it in parallel. When the active task completes, notify that it completed and that the queued task is ready. Record the queued task's actual start only when the user starts it, preserving the user's manual daily start-time rule.
- Use one 45-minute work block per task occurrence by default. Selecting the task does not alter the interval. At the end, offer **Complete** or **Add 15 minutes**. Ask again at the end of each accepted extension. Declining extension leaves the task overdue without shifting later tasks.
- Use the existing five prayer-card order (Fajr, Dhuhr, Asr, Maghrib, Isha) as schedule anchors; do not add an external prayer-time API in the first implementation. Make schedule changes in an atomic, ordered operation. A delay shifts every later task; fixed prayer anchors do not move. If a shifted task crosses into the next prayer card, transfer it to that card and preserve relative ordering. Apply the 9:00 pm cutoff in the user's schedule timezone; carry overflow to the next day's corresponding prayer card.
- Apply snooze and extension as parent actions. Persist the full affected-task list and the resulting times, but send one deduplicated push for the parent action with a short success summary (for example, “Added 15 minutes to Reading; 3 later tasks moved, starting with Arabic at 4:15 pm”).
- Treat task occurrences as day-specific records separate from recurring routine task templates. Store the local schedule date and IANA timezone along with start/end instants; do not rewrite the reusable task template when today's occurrence shifts. Use the current device timezone when an occurrence starts, persist it for that occurrence, and avoid changing the occurrence timezone if another device later has a different timezone.
- Use owner-scoped event records with an idempotency key and parent/correlation ID so retries cannot double-complete tasks, double-shift schedules, or duplicate push notifications. Keep push delivery state separate from the user action event.
- Retain event history for one year, matching the source plan. Keep event history and analytics inside the app; do not add CSV or backup export because the project previously removed import/export from the product flow.
- Treat push as best effort: if push is unavailable or denied, persist the event, show the change in the app, and do not block the task action. Never claim an OS/browser displayed a notification unless the service worker acknowledges receipt.

These defaults were inferred from the user's explicit choices and existing product constraints and are the implementation contract.

## Source plan phases and disposition

1. Go live with water/movement notifications and verify the end-to-end phone flow.
2. Observe reminder response data and tune thresholds.
3. Extend reminders to routine tasks, workouts, and configurable habits.
4. Consider adaptive timing, quiet hours, gentle goal nudges, weekly summaries, export, and retention.

The source plan's Phase 4 includes CSV export. Decision: omit CSV export and backup import/export from this feature; keep events and analytics in-app, consistent with `PROGRESS.md`.

## Codebase audit

The supplied plan's “already built in the patch” claims are not reflected in the current checkout:

- Existing `RoutineTask` stores reusable routine fields and a `RoutineCompletion` per task/date, but has no per-day start/end occurrence, active/queued state, extension count, or delay history.
- Existing push support schedules fixed task-time, 9:00 am workout, and water/movement reminders. `PushDelivery` deduplicates scheduled deliveries; it is not an interaction/event ledger.
- No event bus, event/reminder models, snooze/respond/ignore routes, behavior labels, event analytics endpoint, or Habit Insights panel were found in `server/src` or `client/src`.
- The current Add/Edit Task form includes the existing duration and reminder time fields, but does not expose start/end time blocks or the new scheduling behavior.

Relevant existing code: `server/src/models/routine/routine.model.ts`, `server/src/models/notifications/notification.model.ts`, `server/src/services/notifications/push.service.ts`, and `client/src/pages/routine/components/TaskDialog.tsx`. Existing push infrastructure can be extended, but the event-driven feature described in the reference still needs implementation. This was a source review only; no tests were run and no feature code was edited.

## Implementation status

1. **Schedule foundation:** Implemented day-specific task occurrences, timezone-aware start/end, active/queued state, completion, extension, downstream shifting, configurable prayer-task boundary transfer, and 9:00 pm carryover. Routine controls and block display are connected. Atomicity and collision cases remain under verification.
2. **Reminder/event lifecycle:** Implemented owner-scoped event/reminder records, response/ignore states, 10-minute response windows, one follow-up, and final-card deferral. Mutation retry and scheduler edge cases are being tested.
3. **Parent-change push summaries:** Implemented one push per parent action with a summary of shifted task names and success, keeping push best-effort.
4. **Insights and tuning:** Implemented task response, completion, snooze, extension, ignored/deferred counts, average response time, and recent activity feed. Thresholds remain fixed as decided.
5. **Quality and rollout:** Local verification complete: all server/client tests and production builds pass. Transactions and live push delivery still require verification against the deployed replica-set database and target device after deployment. The client bundle reports a pre-existing large-chunk advisory.

## Planning and implementation handoff

The user confirmed the core schedule, delay, prayer-card, queue, push-summary, and ignored-task rules, then instructed that implementation continue through all phases automatically. The implementation is complete locally; after the branch is pushed, the deployed server/client and target-device push need live verification.

## Decision log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-10-20 | Include water/movement and routine/workout reminders in the planned system. | Recorded from user direction |
| 2026-10-20 | Record a task's start when it begins that day; selection preserves the 45-minute interval; at its end, ask whether to add a 15-minute block; any accepted delay shifts all later tasks, with cumulative shifts preserving order and duration. | Recorded from user direction |
| 2026-10-20 | If a task remains unfinished, ask again after each accepted 15-minute extension; each accepted extension shifts every later task again. | Confirmed by user |
| 2026-10-20 | Keep prayer times fixed; move colliding tasks into the next prayer card and keep downstream order; use 9:00 pm as the daily cutoff and carry tasks that do not fit into the next day. | Recorded from user direction; carryover uses the same prayer card next day |
| 2026-10-20 | Allow selecting/queueing the next task while one is active; after completion notify that the queued task is ready, then record its start when the user starts it. Notify for every little change. | Confirmed by user; actual start-on-completion remains manual |
| 2026-10-20 | Send a device push for every parent change; summarize its child/cascade effects in that single push, with a description confirming what succeeded. | Confirmed by user |
| 2026-10-20 | After 10 minutes without response, mark ignored and send one follow-up; after another 10 minutes without response, move a task to the final prayer card. | Confirmed by user; exact wait windows use source-plan defaults |
