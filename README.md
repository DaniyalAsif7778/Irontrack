# IronTrack

Separate React/Vite client and Express/MongoDB server for routines, workouts, analytics, and body-weight logs.

See [the architecture guide](docs/architecture.md) for the frontend and backend folder conventions and how they relate to the Employee Management System project structure.

See [frontend tooling choices](docs/development-tooling.md) for the data and form stack, and [the roadmap](docs/roadmap.md) for offline-support scope and next steps.

## Run

1. Copy `server/.env.example` to `server/.env`, set `MONGODB_URI`, and replace `AUTH_JWT_SECRET` with a random secret of at least 32 bytes.
2. Copy `client/.env.example` to `client/.env` if the API is not at `http://localhost:4000`.
3. Run `npm install`, then `npm run dev`.

The client runs on `http://localhost:5173`; the API runs on `http://localhost:4000`.

When `VITE_API_URL` points to the API, IronTrack requires an account. New accounts own their routine, weight, workout, and analytics data. Existing unowned MongoDB records are left in place and are not exposed to accounts. Local demo mode remains available when `VITE_API_URL` is unset.

MongoDB must support multi-document transactions (a replica set or sharded cluster) for workout-program saves and account deletion. Signed-in users can permanently delete their account and owned data from Settings after entering their current password and typing `DELETE`. Deletion is completed synchronously in a transaction; the app does not acknowledge success before the owned records and account are removed. See [account authentication and deletion](docs/auth-security.md).
