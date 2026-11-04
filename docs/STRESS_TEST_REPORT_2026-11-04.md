# IronTrack server stress test report

**Run date:** 4 November 2026 (Asia/Karachi)

**Target:** local Express API and an isolated `irontrack_loadtest` database on the configured MongoDB cluster

**Maximum stage:** 50 simultaneous synthetic accounts

## Result

The server completed the 5, 20, and 50 account stages with no failed requests. The test exercised login, workout-plan and weekly-schedule reads and writes, workout-log creation, and read-after-write/account-isolation checks. It created 75 synthetic accounts and issued 675 endpoint requests: 600 returned HTTP 200 and 75 returned HTTP 201. The harness dropped the isolated test database and removed synthetic records afterward.

A preceding lower-load pass (2, 5, and 10 accounts) also completed without endpoint failures: 17 accounts and 153 requests. The tests use small datasets and a single local API process, so they establish a useful baseline rather than a production capacity limit.

## Database-backed endpoint latency

Times below are milliseconds across all 5/20/50 account stages. These include local API, network-to-MongoDB, query, and response time.

| Endpoint | Requests | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| `POST /auth/login` | 75 | 2,230.8 | 5,271.3 | 6,168.6 |
| `GET /workout-plans` | 150 | 859.9 | 1,828.6 | 2,990.3 |
| `GET /workout-week` | 150 | 595.8 | 1,434.0 | 1,661.3 |
| `PUT /workout-plans/:id` | 75 | 2,493.3 | 3,879.3 | 5,603.3 |
| `PUT /workout-week` | 75 | 1,777.2 | 2,610.2 | 3,920.6 |
| `POST /workout-logs` | 75 | 1,583.2 | 2,253.2 | 3,270.1 |
| `GET /workout-logs` | 75 | 353.6 | 975.3 | 1,887.0 |

The 50-account stage completed in 16.70 seconds (about 2.99 synthetic users/second); each account ran its requests sequentially while up to 50 account flows ran concurrently. No requests failed, and read-after-write checks returned each account's own plan, schedule, and log.

## HTTP concurrency check

The running API's database-backed health endpoint was requested at concurrency 1, 10, 25, and 50 (86 requests total). All returned HTTP 200. At concurrency 50, p50 was 39.0 ms and p95 was 42.2 ms. The first single request was 89.9 ms, consistent with a cold local HTTP connection. This check measures the HTTP/health path, not database query throughput.

## Outage behavior found and fixed

The initial disconnected-database probe found that the authentication middleware queried MongoDB before the API could fail fast. Requests waited for Mongo server selection and returned HTTP 500 after about 10 seconds. The API now checks database readiness before dispatching API routes and returns a generic HTTP 503 immediately while disconnected. The health endpoint remains available and reports `503` with `database: disconnected`.

The regression test checks the generic body and requires the health and API outage responses to complete under 500 ms; observed test logs were about 2–5 ms. This prevents a database outage from turning into a long wait or an internal-error response on sign-in/register API calls.

## Database and query observations

- The live API reconnected successfully after the DNS change. On the final restart, MongoDB connected in about 3.37 seconds and the health endpoint returned `200` with `database: connected`.
- Slow-command logging is enabled at 250 ms by default. Startup emitted several `createIndexes` commands above that threshold, so startup index creation is measurable and can add warm-up time.
- Earlier `explain("executionStats")` checks for the routine, completion, workout-log, and analytics query shapes used index scans; the routine-event timeline now uses its owner/date/id compound index to avoid an in-memory sort. The source of truth for future reviews should be production-sized `executionStats` after data volume grows.
- Login and write p95 timings are the largest observed request times in this run. Login includes password verification; workout writes also cross the database network. The sample is too small to attribute those times to one component. Use the slow-command/request-id logs to correlate a slow request before changing bcrypt cost or query behavior.

## Validation

- Server tests: 17 files, 69 tests passed.
- Client tests: 22 files, 77 tests passed.
- `npm run build`: server TypeScript build and client TypeScript/Vite production build passed. Vite printed only the existing Zod/Rollup comment-annotation warnings.
- The security tests cover the per-account 40-write/minute and three-push-tests/15-minute limits; the API-wide limit is 120 requests/minute per process.
- Live API health after restart: HTTP 200, database connected.

## Follow-up recommendations

1. Repeat the isolated database test with representative data volume and from the deployed server's region before setting a capacity target; this run used one local API process and a small test dataset.
2. Correlate slow API request IDs with MongoDB slow-command logs. If the API call is slow but no database command is, profile CPU work such as password verification; do not lower password hashing strength based on this small run alone.
3. If deploying multiple API replicas, move rate-limit state from the current per-process store to a shared store so the configured limits apply across all replicas.
4. Keep index creation intentional in deployments. The added query logging will show when index creation or database commands delay startup or requests.

## Scope limits

This was a bounded functional/load test, not a destructive soak test, security penetration test, or production-scale capacity certification. It did not send real push notifications or verify email delivery. The synthetic test data was isolated in the test database and removed by the harness.

The notification and analytics endpoints were not included in the 675-request mix. A previous live sample of the seven-day analytics endpoint was about 273–306 ms with only a few records; that small-data timing is not a load result. Test notification delivery on a real device separately because the current harness does not exercise the browser push service or device audio policies.
