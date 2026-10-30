# Account authentication

## Flow and safeguards

- Registration creates an inactive account and emails a 256-bit, single-use verification link. Only its SHA-256 digest is stored. Verification links expire after 30 minutes, and registration does not create a session.
- Unverified accounts expire after seven days without a resend; MongoDB TTL removes those pending account records automatically.
- Passwords are stored with bcrypt (12 rounds). New passwords require 12–128 characters. Login failures share one generic response, including for unverified accounts.
- Password recovery uses the same single-use, 30-minute hashed-token pattern. Requests use a generic response; a successful reset revokes all refresh sessions.
- Access and rotating refresh tokens remain in HTTP-only, SameSite=Lax cookies. Refresh session records retain device user-agent, IP, last-use time, and expiry. Users can review and revoke sessions in Settings. Revoking a session also clears its cookies when it is the current device; an already-issued access token can remain valid for at most 15 minutes.
- Login, registration, email actions, and token submissions have separate IP-based limits. The existing API-wide limiter is also active. The default express-rate-limit memory store is per server process; deployments with multiple API instances should configure a shared limiter store before scaling horizontally.
- Auth links keep tokens in the URL fragment. Browsers do not send fragments in HTTP requests or referrers; the page removes the fragment before calling the API.
- Verification and recovery messages are added to a Redis-backed BullMQ queue. The API responds after Redis accepts the job; a separate worker sends it with bounded concurrency, a five-message-per-second limiter, and five exponential-backoff attempts. Queue payloads carry AES-GCM encrypted link tokens, while Redis is password-protected, private to the Compose network, and configured for append-only persistence. Failed-job logs contain job metadata only, not recipient addresses, SMTP responses, or link tokens. A worker crash after SMTP accepts a message but before Redis acknowledges it can produce a duplicate email; each link remains single-use.

## Mail configuration

Set these values in the server runtime environment (never commit real credentials):

```env
EMAIL_USER=your-sending-address@gmail.com
EMAIL_PASS=your-new-google-app-password
CLIENT_URL=https://irontrack-nu.vercel.app
REDIS_URL=rediss://default:password@your-private-redis-host:6379/0
AUTH_JWT_SECRET=your-existing-random-secret-of-at-least-32-bytes
EMAIL_WORKER_CONCURRENCY=5
```

For local development, set `CLIENT_URL=http://localhost:5173`. Gmail requires 2-Step Verification and an App Password for this SMTP setup. The sender address must match `EMAIL_USER`. `CLIENT_URL` must be HTTPS in production. Set it to the exact public origin used by the client. `server/.env.example` lists these keys.

The app password shared during setup should be revoked and replaced because it was exposed in chat. Add the replacement only to the ignored local `server/.env` and the server host's secret environment settings. Add the sender address, replacement password, and production client URL to the deployment environment; no credential is stored in this repository.

`REDIS_URL` and `AUTH_JWT_SECRET` are required for queueing and encrypting link tokens. Use a private Redis endpoint with persistence enabled; use `rediss://` when the provider requires TLS. The API service and at least one `node dist/workers/authEmail.worker.js` worker must share the same Redis database and environment. Set `EMAIL_WORKER_CONCURRENCY` from 1 to 20 to bound worker concurrency; each worker also limits sending to five messages per second.

For a portable Docker setup, copy `server/.env.docker.example` to `server/.env.docker`, fill in secrets (generate a Redis password with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`), then run `docker compose --env-file server/.env.docker up --build -d` from the repository root. The root `compose.yaml` builds the API and worker from the same image, starts Redis privately with AOF persistence and a health check, and keeps Redis data in a named volume. Run `docker compose --env-file server/.env.docker logs -f api auth-email-worker` to inspect service logs. Keep `server/.env.docker` out of version control.

For source-mode development instead, start Redis locally, set `REDIS_URL=redis://127.0.0.1:6379/0` in `server/.env`, and run `npm run dev:email-worker -w server` in a second terminal alongside the API and Vite processes.

On a managed host such as Suga, configure a private/persistent Redis service, deploy the API and a separate worker process from this Docker image, and set the same `REDIS_URL`, `AUTH_JWT_SECRET`, and SMTP settings on both. A Git push can trigger the configured API deployment, but it cannot provision Redis or a worker on a host that has not been configured for those services. Gmail can be used for initial testing and small volumes; a dedicated SMTP provider is preferable for production-scale sending.

## Research basis

The implementation follows OWASP guidance for verified ownership, random single-use time-limited tokens, generic recovery responses, throttling, and avoiding token logging, plus Nodemailer's Gmail SMTP guidance:

- [OWASP Email Validation and Verification Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Nodemailer: Using Gmail](https://nodemailer.com/guides/using-gmail)
