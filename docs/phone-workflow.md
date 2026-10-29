# Use IronTrack from your phone

## What is ready

- Phone layout with a bottom navigation bar, safe-area spacing, and a compact More menu.
- Workout sessions can be paused, resumed, ended, and continued after a refresh. Set entries and the active timer are stored on the device until the session is finished.
- Workout stats include Summary, Overview, Volume, History, and PRs. Selecting an exercise opens its load chart and set history.
- Routine has Routine and Analytics views. Wellness tracks water and movement. The header reminder center lists today's upcoming task reminders.
- The PWA manifest and service worker are configured. The app shell can reopen after a visit, and the home screen install prompt shows browser-specific instructions.

## Install

Install the app from its **HTTPS deployment URL**. On Android/Chrome, use the in-app **Install** prompt or the browser menu's **Install app** action. On iPhone/iPad, open the URL in Safari, tap **Share**, then **Add to Home Screen**. The local development URL is for the computer running the app and is not a phone deployment.

## Free hosting setup

The app uses a React/Vite frontend, an Express API, and MongoDB Atlas. One low-cost setup to start with is a Cloudflare Pages static site, a Render free web service for the API, and an Atlas Free database. Provider limits can change. Render's free service sleeps after inactivity, so the first API request after a quiet period may be slow; its own docs describe the free tier as suitable for hobby/testing use ([Render free services](https://render.com/docs/free)). Atlas free cluster limits are documented in [MongoDB Atlas pricing](https://www.mongodb.com/pricing).

### Frontend

- Build command: `npm ci && npm run build -w client`
- Output directory: `client/dist`
- Set build variable `VITE_API_URL` to the API URL ending in `/api`, for example `https://your-api.example.com/api`.
- Configure the static host to serve `index.html` for app routes such as `/workout/stats` and `/exercise/...`.

### API

- Build command from the repository root: `npm ci && npm run build -w server`
- Start command: `npm run start -w server`
- Set `NODE_ENV=production`, `MONGODB_URI`, and a long random `AUTH_JWT_SECRET` in the API host's private environment settings. Set `PORT` if the provider requires it. Do not commit `.env` files or paste secret values into GitHub.
- Add the API host to the MongoDB Atlas network access list. For a hosted API, `127.0.0.1` on the development machine is not reachable from the internet.
- The current backend intentionally reflects every request origin to support the requested development setup. Before public deployment, update `server/src/app.ts` to allow only the frontend's HTTPS origin. Credentialed cookies require the exact origin, not `*`.
- Create and verify an account, then sign in from each phone or browser to access its private data.

## Notifications and connectivity

Browser notifications need HTTPS (except localhost) and permission from the user. From **Wellness → Reminders**, enable background notifications on each phone/browser and use **Send server test** to confirm delivery. The Express server stores each device subscription in MongoDB and checks routine task times, the workout plan at 9 AM, and optional water/movement reminders at 10 AM, 2 PM, and 6 PM in that device's timezone. Completed routine tasks, completed workouts, and reached wellness goals are skipped. Notification taps open the related IronTrack page.

Web Push uses browser platform push services and the open-source `web-push` library; IronTrack does not use a paid notification provider. Add `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` to the API host's environment. Generate a key pair with `npx web-push generate-vapid-keys` and keep the private key only in the API host's secret environment settings or ignored `server/.env`; never add it to Vite `VITE_*` variables or commit it. Your local development pair is in `server/.env`. The frontend receives only the public key through the authenticated API. If you rotate the pair, users must re-enable notifications on their devices. The API host must be awake when a reminder is due; a sleeping free host can delay a reminder until it wakes. A browser/OS may also suppress notifications if site permission is disabled or the device is in a restricted mode.

The service worker caches the app shell and static build assets. Routine, workout, weight, wellness, and settings writes still need the API connection. The app does not currently queue server changes while offline. It also does not synchronize records between devices; use the same deployed account and API to access the MongoDB-backed records.

## Before sharing the deployment

1. Set the private host environment values and test sign-in, routine task completion, workout save, and wellness updates from the phone.
2. Restrict CORS to the frontend domain.
3. Confirm the HTTPS certificate and browser notification permission on the target phone.
4. Verify the API host's free-tier sleep and database limits meet the expected use.

Cloud sync and backup export/restore were intentionally left out of this project scope.
