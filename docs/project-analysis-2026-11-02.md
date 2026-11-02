# IronTrack project analysis — 2026-11-02

The current checkout now covers the requested routine timing rules, automatic 1:00 AM routine rollover, workout-name editing and day navigation, `/auth/me` response handling, and the email verification/auth audit. The server and client production builds pass, and the full test suites pass (52 server tests and 67 client tests). The HTML/CSS review is source/build based; live SMTP delivery and computed styles in a rendered browser still need deployment or browser verification.

## Project shape

- IronTrack is an account-based PWA with a React, TypeScript, and Vite client in `client/`, and an Express, TypeScript, and Mongoose API in `server/`.
- The API stores account-owned routine, workout, wellness, weight, notification, and session data in MongoDB. API routes are grouped by domain; controllers parse requests, services implement domain operations, and Mongoose models persist data.
- TanStack Query manages API reads and mutations. Zustand stores client preferences and the selected routine date. The API helper uses the same-origin `/api` prefix in production and a local API URL during development.
- The PWA provides an installable app shell and service worker. Its offline mutation queue is deliberately limited to routine completion and finished workout logs; other edits require a live API connection.

## Findings and completed work

### Routine schedule and day boundary

- New routine tasks default to a 45-minute duration, start at the configured prayer-block opening, and derive their end from start plus duration. The end field is read-only in the form.
- Client and server validate configured prayer windows, chronological prayer anchors, reminder times, and overlaps. Server checks protect the same constraints for API callers. Removing the old reset control avoids bulk-unchecking tasks as a substitute for advancing the day.
- `ironToday()` treats 1:00 AM local time as the routine-day boundary. The app checks every 15 seconds and on return to the foreground, advances the selected date only when it still points at the prior routine day, and preserves a manually selected date.

### Workout plan interaction

- Workout-day navigation uses a horizontally scrollable strip in both normal and plan-edit modes, including on small screens.
- Inline workout name inputs disable browser autocomplete suggestions. The existing edit/save flow remains responsible for persisting plan changes.

### `/auth/me` and email verification

- The server's authenticated session endpoint responds with `{ user }`; an unauthenticated request returns 401. The client previously dereferenced `response.user` without checking that the response existed or had the expected envelope. An absent/malformed response could therefore look like a signed-out user and route home.
- `AuthGate` now validates the session envelope and required user fields/preferences. A malformed success response produces a recoverable account error with a retry action rather than silently rendering the public landing page.
- API tests now cover unauthenticated access, registration issuing verification mail without granting a session, verification-link acceptance, and the authenticated `{ user }` response. Client tests cover the undefined-response regression.
- Verification and password recovery use hashed, expiring, single-use challenges. Mail is sent synchronously by Nodemailer from the API. Redis, BullMQ, encrypted queue payloads, worker files, and worker deployment settings have been removed. SMTP failure removes the just-issued challenge and returns a generic retryable error.
- The test suite verifies the SMTP call and API flow; it does not prove that Gmail or another provider accepted or delivered a real email. Production still needs valid `EMAIL_USER`, `EMAIL_PASS`, and `CLIENT_URL` values in private API settings.

### HTML and CSS audit

- `client/index.html` is the only source HTML file. It defines document metadata, a `#root` mount, and the `main.tsx` entry point; it is not a separate UI page with unstyled controls.
- `client/src/main.tsx` imports `client/src/styles.css`, which supplies the React interface styles. The successful Vite production build emitted a CSS asset linked from the generated HTML.
- This confirms the source/build wiring and absence of additional standalone HTML pages. It does not confirm computed layout, contrast, or responsive appearance in a running browser.

## Verification evidence

- `npm run build` — passed for the server TypeScript build and client TypeScript/Vite production build. Vite reports dependency comment-annotation notices from Zod; they do not fail the build.
- `npm test` — passed: 13 server test files / 52 tests and 21 client test files / 67 tests.
- `git diff --check` — passed during the final review.
- No live SMTP delivery or deployed API check was performed in this pass. No commit or push was performed.

## Remaining operational checks

1. Configure private SMTP credentials and the production client origin in the API host, then register a real account and verify receipt and one-time link behavior.
2. Verify the authenticated session cookie and `/api/auth/me` response against the deployed client/API origin arrangement.
3. Open the deployed PWA in target desktop and phone browsers to inspect computed styles, horizontal workout navigation, and the 1:00 AM transition after the device's local boundary.
4. Confirm MongoDB transaction support and production CORS, HTTPS, proxy, and health settings as listed in [the roadmap](roadmap.md) and [auth guidance](auth-security.md).

See [project context](../context.md), [implementation progress](../PROGRESS.md), and [the implementation roadmap](roadmap.md) for the current handoff.
