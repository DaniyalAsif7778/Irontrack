# Account authentication

## Flow and safeguards

- Registration creates an inactive account and emails a 256-bit, single-use verification link. Only its SHA-256 digest is stored. Verification links expire after 30 minutes, and registration does not create a session.
- Unverified accounts expire after seven days without a resend; MongoDB TTL removes those pending account records automatically.
- Passwords are stored with bcrypt (12 rounds). New passwords require at least 15 characters and are limited to 72 UTF-8 bytes to avoid bcrypt's input truncation. Existing accounts can still sign in with their current passwords. Login failures share one generic response, including for unverified accounts.
- Password recovery uses the same single-use, 30-minute hashed-token pattern. Requests use a generic response; a successful reset revokes all refresh sessions.
- Access and rotating refresh tokens remain in HTTP-only, SameSite=Lax cookies. Refresh session records retain device user-agent, IP, last-use time, and expiry. Users can review and revoke sessions in Settings. Revoking a session also clears its cookies when it is the current device; an already-issued access token can remain valid for at most 15 minutes.
- Account deletion is available only to an authenticated user and requires the current password plus the exact confirmation `DELETE`. The API deletes the account's routine tasks, task-linked completion records, routine events/reminders/occurrences, workout plans/program/exercise library/logs/progression, wellness and weight logs, push subscriptions/delivery records, auth challenges, and refresh sessions in one awaited MongoDB transaction. It commits before returning success and clears the current device's cookies. Protected requests also verify that the account still exists, so access tokens on other devices stop working immediately after deletion. A failed cascade aborts the transaction and leaves the account intact.
- Multi-document transactions require a MongoDB replica set or sharded cluster. The client clears the deleted account's query cache, offline write queue, active workout/timer state, and locally stored preferences after server success. If browser storage is unavailable, the account is still signed out and deleted server-side, with a warning that local browser data may need manual clearing.
- Login, registration, email actions, and token submissions have separate IP-based limits. Authenticated writes have an additional per-account limit of 40 requests per minute, and push-test sends are limited to three per 15 minutes. The API-wide IP limit also applies. These limits use in-process memory; deployments with multiple API instances must enforce shared limits at the gateway or add a compatible shared store before scaling horizontally.
- API responses use `Cache-Control: no-store`. JSON bodies are limited to 1 MB, malformed payloads receive a 400, and oversized payloads receive a 413.
- Auth links keep tokens in the URL fragment. Browsers do not send fragments in HTTP requests or referrers; the page removes the fragment before calling the API.
- Verification and recovery messages are sent synchronously through SMTP from the API process. Link tokens are never logged, and mail failures return a generic retryable service error while removing the newly issued challenge. Configure SMTP and the public client URL before enabling registration or recovery. Direct delivery avoids Redis and a separate worker, but the request remains open until the SMTP provider responds.

## Mail configuration

Set these values in the server runtime environment (never commit real credentials):

```env
EMAIL_USER=your-sending-address@gmail.com
EMAIL_PASS=your-new-google-app-password
CLIENT_URL=https://irontrack-nu.vercel.app
AUTH_JWT_SECRET=your-existing-random-secret-of-at-least-32-bytes
```

For local development, set `CLIENT_URL=http://localhost:5173`. Gmail requires 2-Step Verification and an App Password for this SMTP setup. The sender address must match `EMAIL_USER`. `CLIENT_URL` must be HTTPS in production. Set it to the exact public origin used by the client. `server/.env.example` lists these keys.

The app password shared during setup should be revoked and replaced because it was exposed in chat. Add the replacement only to the ignored local `server/.env` and the server host's secret environment settings. Add the sender address, replacement password, and production client URL to the deployment environment; no credential is stored in this repository.

For local source-mode development, configure MongoDB and SMTP in `server/.env` and run `npm run dev`. The API sends verification and recovery messages directly; no Redis service or email worker is needed. On a managed host, deploy the API with `npm run build` and `npm start -w server`, and configure the SMTP credentials and client URL in the host's private environment. Gmail can be used for initial testing and small volumes; a dedicated SMTP provider is preferable for production-scale sending.

## Research basis

The implementation follows OWASP guidance for verified ownership, random single-use time-limited tokens, generic recovery responses, throttling, and avoiding token logging, plus Nodemailer's Gmail SMTP guidance:

- [OWASP Email Validation and Verification Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Nodemailer: Using Gmail](https://nodemailer.com/guides/using-gmail)
