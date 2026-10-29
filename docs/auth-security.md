# Account authentication

## Flow and safeguards

- Registration creates an inactive account and emails a 256-bit, single-use verification link. Only its SHA-256 digest is stored. Verification links expire after 30 minutes, and registration does not create a session.
- Unverified accounts expire after seven days without a resend; MongoDB TTL removes those pending account records automatically.
- Passwords are stored with bcrypt (12 rounds). New passwords require 12–128 characters. Login failures share one generic response, including for unverified accounts.
- Password recovery uses the same single-use, 30-minute hashed-token pattern. Requests use a generic response; a successful reset revokes all refresh sessions.
- Access and rotating refresh tokens remain in HTTP-only, SameSite=Lax cookies. Refresh session records retain device user-agent, IP, last-use time, and expiry. Users can review and revoke sessions in Settings. Revoking a session also clears its cookies when it is the current device; an already-issued access token can remain valid for at most 15 minutes.
- Login, registration, email actions, and token submissions have separate IP-based limits. The existing API-wide limiter is also active. The default express-rate-limit memory store is per server process; deployments with multiple API instances should configure a shared limiter store before scaling horizontally.
- Auth links keep tokens in the URL fragment. Browsers do not send fragments in HTTP requests or referrers; the page removes the fragment before calling the API.
- Mail delivery is started in the background so verification and recovery responses do not reveal whether an address has an account. Delivery failures are logged without addresses or SMTP responses; users can request another link. This process-local send is suitable for this single API service; add a durable queue before scaling to short-lived or multiple server instances.

## Mail configuration

Set these values in the server runtime environment (never commit real credentials):

```env
EMAIL_USER=your-sending-address@gmail.com
EMAIL_PASS=your-new-google-app-password
CLIENT_URL=https://irontrack-nu.vercel.app
```

For local development, set `CLIENT_URL=http://localhost:5173`. Gmail requires 2-Step Verification and an App Password for this SMTP setup. The sender address must match `EMAIL_USER`. `CLIENT_URL` must be HTTPS in production. Set it to the exact public origin used by the client. `server/.env.example` lists these keys.

The app password shared during setup should be revoked and replaced because it was exposed in chat. Add the replacement only to the ignored local `server/.env` and the server host's secret environment settings. Add the sender address, replacement password, and production client URL to the deployment environment; no credential is stored in this repository.

Gmail is suitable for initial testing and small-volume use, but Nodemailer advises against Gmail for production sending workloads. Moving to a dedicated mail service or domain SMTP relay requires choosing and configuring that service; no additional provider was added here.

## Research basis

The implementation follows OWASP guidance for verified ownership, random single-use time-limited tokens, generic recovery responses, throttling, and avoiding token logging, plus Nodemailer's Gmail SMTP guidance:

- [OWASP Email Validation and Verification Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Nodemailer: Using Gmail](https://nodemailer.com/guides/using-gmail)
