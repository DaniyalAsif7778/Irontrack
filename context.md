# IronTrack project context

Last updated: 2026-11-02

## Current state

IronTrack is a responsive React/Vite PWA backed by a TypeScript Express API and MongoDB. User-owned routine, workout, weight, wellness, and reminder data require an authenticated account. The application repository does not include Docker/Compose packaging; production hosting must provide MongoDB separately. Auth email is delivered directly through the API's configured SMTP transport.

## Current behavior

- Routine tasks are organized around Fajr, Dhuhr, Asr, Maghrib, and Isha prayer anchors. For a scheduled task, the user selects its start and duration; the end is calculated. Client and server validation enforce the selected prayer window and reject overlaps. Prayer anchors must be configured in chronological order.
- Routine dates change at 1:00 AM local time. An open app checks for the boundary and advances only when the user has not selected a different date. There is no manual reset control.
- Workout progression is opt-in and advances after the rest countdown; set logging remains deliberate. Optional speech announces exercise/set/tempo cues and stops when paused or resting.
- Workout-day names are free-form text. The weekly day selector scrolls horizontally on narrow screens and while editing.
- Registration requires email verification before a session is granted. Verification links are single-use, expire after 30 minutes, and are sent through SMTP by the API before the request completes.
- The HTML entry point is only the app mount shell; `client/src/main.tsx` imports `client/src/styles.css` for the React interface. The rendered application, not the shell markup, is where UI styling should be audited.

## Architecture and safeguards

- `client/`: TypeScript, React, Vite, React Router, TanStack Query, Zustand, and Zod.
- `server/`: TypeScript, Express, MongoDB/Mongoose, cookie sessions, and Nodemailer SMTP delivery.
- Sensitive auth and account writes are rate limited; authenticated mutations also have a per-account cap. API JSON is limited to 1 MB and API responses are marked `no-store`.
- Auth verification and recovery tokens are hashed in MongoDB. Real mail delivery requires valid SMTP credentials and a public `CLIENT_URL`; direct SMTP delivery does not use Redis or a worker.
- Local environment files contain private configuration and must remain ignored. Never copy secrets into docs, commits, client variables, or logs.
- Supported offline writes are limited to routine completions and finished workout logs; other edits require the API.

## Remaining verification

- Unit tests can verify auth routes, direct SMTP invocation, and token handling, but they do not prove that the configured SMTP provider delivered a real message. Confirm email delivery on the deployed API with private runtime configuration.
- Before production use, verify MongoDB health, HTTPS and cookie origin settings, CORS allow-listing, and a real account verification flow.
- Run a rendered-browser responsive check when validating UI styling; source CSS inspection alone cannot prove the final computed appearance.

The 2026-11-02 quality/security review and signed-in UX follow-up passed the full local test suite (126 server and 70 client tests), both builds, npm audit, local API/Mongo health, and Mongo index-plan checks. Routine task editing now includes keyboard-accessible dialog behavior; analytics provides text/data-table alternatives and account-scoped weekly focus. The Vite demo runs at `http://127.0.0.1:5174/` with the API at `http://127.0.0.1:4000`. SMTP delivery, deployed cookie/CORS settings, live push, visual/browser accessibility, and production operations remain to be confirmed. See [the review](docs/quality-security-review-2026-11-02.md).

See [the 2026-11-02 project analysis](docs/project-analysis-2026-11-02.md), [PROGRESS.md](PROGRESS.md), [docs/roadmap.md](docs/roadmap.md), and [docs/auth-security.md](docs/auth-security.md) for implementation and deployment details.
