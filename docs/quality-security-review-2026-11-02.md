# IronTrack quality, security, and standards review

Reviewed: 2026-11-02
Scope: React/Vite client, Express/MongoDB API, dependency tree, local runtime, API behavior, database indexes, existing automated tests, metadata/SEO, and Pakistan/international readiness.

This is a code and local-runtime review, not a penetration test, legal opinion, independent WCAG conformance audit, or certification. Scores are engineering estimates based on the checks listed below; they are not a pass/fail standards badge.

## Overall assessment

**Provisional overall score: 6.8/10.** IronTrack has a useful responsive fitness and habit product with owner-scoped account data, verification/recovery flows, a PWA shell, and substantial automated coverage. This review fixed several concrete issues and got the local app connected to MongoDB. The largest remaining gaps are live email and push delivery verification, shared rate-limit storage before horizontal scaling, browser/device accessibility checks, public SEO rendering, operational monitoring, and privacy/retention disclosures.

| Area | Score | Evidence and main gap |
| --- | ---: | --- |
| Security and account handling | 7.5/10 | Ownership checks, verified accounts, hashed single-use auth tokens, cookie sessions, throttling, reduced error detail, and request limits. No independent penetration test; rate limits are process-local. |
| API correctness and validation | 7.5/10 | Error and malformed-input coverage plus strict date/time validation. SMTP and push provider behavior still need live-environment checks. |
| Data access and query performance | 7/10 | Owner/date and schedule indexes exist in MongoDB; the workout-history explain plan used the expected index. No representative production data/load profile was available. |
| Frontend usability and accessibility | 6.5/10 | Responsive layouts, semantic labels, visible field errors, keyboard focus styling, and reduced-motion rules exist. No screen-reader, keyboard-only, contrast, or device lab audit was run. |
| Pakistan readiness | 6/10 | Asia/Karachi is accepted as an IANA timezone and the app's manual prayer anchors support local routines. Urdu/RTL, local-calendar/content preferences, real Pakistan mobile network/device testing, and localized privacy/support content need work. |
| International readiness | 6.5/10 | Browser timezone and kg/lb preferences are supported. Translation/RTL, locale-specific number/date review, and cross-browser/device verification remain. |
| SEO and discoverability | 5.5/10 | Descriptive title/description, canonical, Open Graph/Twitter metadata, WebSite JSON-LD, robots and sitemap exist. The public page is client-rendered; route metadata is changed after JavaScript runs, so social crawlers and non-JS crawlers may not see it reliably. |
| Performance and maintainability | 7/10 | Removed unused dependencies and unreachable mock API implementation; route-level code splitting is present. The chart vendor chunk is about 404 kB raw (116 kB gzip); no real-user/Core Web Vitals data was collected. |
| Reliability and operations | 6/10 | Health endpoint reflects MongoDB state and the local MongoDB connection is healthy. No deployed backup/restore drill, alerting, SMTP delivery check, or multi-instance validation was performed. |

## Work completed in this review

- Fixed the development API URL mismatch: Vite defaults to `127.0.0.1:4000`, matching the API's current local configuration. Before this correction, the frontend called port 4001 while the API listened on 4000.
- Added global API request limiting and per-account throttling for authenticated writes, with a tighter limit for push-test sends. Existing authentication routes retain separate limits.
- Reduced JSON request size to 1 MB, return 400 for malformed JSON and 413 for oversized bodies, mark API responses `no-store`, and keep internal 500 details out of client responses/log fields.
- Fixed push subscription ownership: an endpoint already registered to another account cannot be transferred by an upsert.
- Added strict real-calendar ISO date validation, invalid IANA timezone handling, and consistent client errors for invalid routine/weight payloads.
- Added compound indexes for routine schedule/reminder lookups, due-occurrence/follow-up scans, and workout history. Confirmed all five named indexes exist in the connected MongoDB database. A representative workout-history query plan used `IXSCAN`; the synthetic owner query examined zero documents, so this validates index selection, not production latency.
- Tightened new/reset password policy to 15+ characters and 72 UTF-8 bytes (bcrypt input limit). Existing accounts retain their current sign-in behavior.
- Updated the root route's robots handling so server/session errors are not marked indexable; private/auth routes are noindex.
- Removed unused UI/server dependencies and unreachable local mock API data code; corrected package/tooling docs to match installed packages.
- Upgraded vulnerable dependency versions. `npm audit` reports zero known vulnerabilities at review time.

## Verification performed

- Full tests: server **35 files / 126 tests passed**; client **21 files / 67 tests passed**.
- Production builds: client TypeScript + Vite build passed; server TypeScript build passed.
- `npm audit`: zero vulnerabilities.
- `git diff --check`: passed; Git printed only line-ending conversion warnings.
- Local demo: Vite returned HTTP 200 on `http://127.0.0.1:5174/`; title was present. API health returned HTTP 200 with MongoDB connected on port 4000. `/api/auth/me` returned 401 without a session, as expected.
- Database indexes: five newly added/important named indexes were found in MongoDB. Workout-history explain selected an index scan.
- Existing tests cover account/session/validation behavior, push subscription ownership, Asia/Karachi timezone acceptance in push payload validation, timezone-aware notifications, and the 1 AM routine boundary including year rollover.

## Standards and regional benchmark

### International

- **OWASP API Security Top 10 (2023):** work addressed resource-consumption controls and an object-ownership flaw found in push-subscription upsert. This is not a full mapping or penetration test; continue endpoint-by-endpoint authorization review and shared-store throttling before scaling. [OWASP API Security Project](https://owasp.org/www-project-api-security/)
- **OWASP authentication guidance:** the new-password minimum is 15 characters when MFA is not in use, with a maximum above 64 characters at the form/schema layer; bcrypt's 72-byte input ceiling is enforced explicitly. [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- **W3C WCAG 2.2:** use Level AA as the target for the next manual accessibility pass. Source checks are not a conformance result. [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- **Google Search:** public HTML includes metadata but the page content and route-specific metadata are React-rendered. Prerendering/server rendering the public landing page is the highest-impact SEO improvement; verify actual rendered HTML and Search Console after deployment. [Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

### Pakistan

- Pakistan testing in this review means code-level regional readiness, not a Pakistan-based user study or legal certification. The app accepts `Asia/Karachi`; prayer anchors are manually configured by users, avoiding an unsupported claim of calculated prayer times.
- Before launch to Pakistan users, validate Urdu translations and right-to-left layout, mobile usability on constrained networks, accessible local support/privacy text, and the chosen data-hosting/retention model.
- The official MoITT legislation page checked for this review lists the Personal Data Protection Bill (May 2023) as a draft. This does not remove obligations under other applicable laws; have Pakistan counsel review the product, data flows, user notice, and incident process before commercial release. [MoITT legislation list](https://www.moitt.gov.pk/Legislations) · [Pakistan Code: PECA](https://www.pakistancode.gov.pk/pdffiles/administrator6a061efe0ed5bd153fa8b79b8eb4cba7.pdf)

## Remaining risks and recommended order

1. **Before production:** configure HTTPS, exact CORS/client origin, secure cookies, `TRUST_PROXY` for the actual proxy chain, SMTP and VAPID secrets. Confirm account verification, recovery, push delivery, and cookie behavior using a dedicated test account on the deployed host.
2. **Before multiple API instances:** move rate-limit counters to a shared store or enforce them at a trusted gateway. Current express-rate-limit memory is per process and resets on restart.
3. **Before wider data collection:** publish a clear privacy notice, data-retention policy, account/data request process, and vendor/subprocessor list. Verify backups, restore, and account deletion behavior in the actual MongoDB topology.
4. **Accessibility:** run keyboard-only flows and screen-reader checks for signup, routine editing, workout logging, charts, dialogs, and errors; measure text/control contrast and touch target sizes against WCAG 2.2 AA.
5. **Pakistan/international UX:** add Urdu/RTL and locale testing; test `Asia/Karachi` rollover and prayer reminders on real devices. Keep prayer time calculations out until a reliable source/method and user confirmation flow are chosen.
6. **SEO/performance:** prerender the public landing route, use route-specific metadata in initial HTML, confirm canonical host, and measure mobile Core Web Vitals. Review the chart chunk and only split further if field measurements justify it.
7. **Operational quality:** add structured health/readiness monitoring, error alerts that exclude secrets/personal payloads, a Mongo backup/restore exercise, and a production smoke test.

## Local demo

Start from the repository root with `npm run dev`. The landing page is available at `http://127.0.0.1:5174/`; API health is at `http://127.0.0.1:4000/api/health`. On this review machine, MongoDB connected successfully. Email verification was not live-tested, so creating a new account may require SMTP configuration before it can be used. The demo server is a local development process, not a production deployment.

## Signed-in experience follow-up

The follow-up work focused on the authenticated app; the public landing page was left unchanged.

- Routine task editing now exposes a labelled modal dialog, moves focus into the title field, keeps keyboard focus inside, closes with Escape, and restores focus to the opener. Form inputs have explicit accessible names and title errors are associated with the title field.
- Analytics range controls announce their time period and selected state. Charts have concise text summaries and expandable data tables for screen-reader and keyboard users.
- Weekly review preferences are keyed by account, so one user’s saved focus does not appear for another user on a shared browser. Blocked browser storage does not crash the page.
- Weekly review no longer presents failed requests as zero activity. It shows a partial-data message and retry action, and distinguishes loading/unavailable metrics.
- Regression tests now cover dialog focus/Escape behavior, accessible chart data, account-separated preferences, and weekly review retry.

Follow-up verification: server **35 files / 126 tests passed**; client **21 files / 70 tests passed**; both production builds passed. `npm audit` remained at zero vulnerabilities. The client bundle reports the same Zod/Rollup annotation warnings as before; the build succeeds and Rollup removes those comments.

## Mobile workout and routine follow-up (2026-11-02)

Manual workout assignment remains user-triggered. The app does not choose or recommend a workout on the user's behalf. The selected workout title can be edited inline in the overview; the check action updates the visible draft and closes the field, and the page-level Save changes action writes the draft to the workout-program API and refreshes query data.

Routine analytics now uses a shared period selection and the routine activity endpoint's page/total metadata. Activity pages use per-period/per-page cache keys, five-minute staleness, and independent loading/error/retry UI. The screenshot review was performed at the app's narrow mobile viewport. Full account registration and real SMTP delivery remain environment-dependent.
