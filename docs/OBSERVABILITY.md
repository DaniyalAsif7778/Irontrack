# Database and notification diagnostics

The API writes structured JSON logs to stdout. In local development, read the server terminal. On deployment, read the provider's runtime logs.

- Each HTTP response includes an `X-Request-Id`. The access log includes the same ID, and unhandled API errors log it with method, route, status, error name, message, and code. Share that ID with an error report.
- MongoDB commands that take at least 250 ms produce a `Slow MongoDB command` warning. Set `MONGO_SLOW_QUERY_MS` to a different positive threshold in the server environment.
- Failed MongoDB commands log command name, duration, MongoDB request ID, and error name/code. Query values, request bodies, push endpoints, and subscription keys are not logged.
- Connection failures log the attempt number and next retry delay. Retries use exponential backoff with jitter, up to about two minutes.
- Notification delivery failures log a category plus error name/status/code. The scheduler no longer silently discards task reminder delivery errors.
- `GET /api/health` returns `200` when MongoDB is connected and `503` while the database is unavailable. It intentionally does not expose connection strings or internal error details.

The client caches analytics results for five minutes. The server query plans and live sample timings are environment-specific; check the MongoDB logs and `explain("executionStats")` again with production-sized data before adding further indexes.
