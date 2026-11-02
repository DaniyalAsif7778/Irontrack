# IronTrack project structure

IronTrack follows the Employee Management System project's folder structure. Frontend screens are grouped under `pages/`, reusable UI lives under `components/ui/`, and API helpers have a dedicated `lib/api/` folder. The backend uses domain folders for controllers and models, with a central router, middleware, utilities, and database connection module.

## Frontend

```text
client/src/
  App.tsx                 # App-level data and authenticated routes
  Layout.tsx              # Responsive desktop/mobile navigation
  components/
    components.ts          # Shared component exports
    AuthGate.tsx           # Session gate and public/authenticated routing
    NotificationScheduler.tsx
    OfflineSyncStatus.tsx  # Account-scoped queue status and retry
    ui/                    # Shared buttons, metrics, navigation, and timers
  pages/
    analytics/             # Routine and activity analytics
    auth/                  # Sign-in, sign-up, and account recovery
    home/                  # Signed-in dashboard
    profile/               # Mobile profile menu
    public/                # Signed-out landing page
    routine/               # Routine page and screen-only components
      components/
    schedules/             # Routine schedule editor
    settings/              # Account and training preferences
    weight/                # Weight tracking page
    workout/               # Workout editor, sessions, history, and stats
  hooks/                   # Routine, weight, analytics, and query keys
  stores/                  # Small client-side preference state
  lib/
    api/                   # API client and account-scoped offline queue
  schemas/                 # Form/input validation
  types.ts                 # Shared client types
  utils/                   # Date and other shared helpers
  styles.css               # Theme tokens and global styles
```

Follow the EMS `pages/<area>/` pattern for screens, and put screen-only subcomponents beside their page. Add a shared component in `components/ui/` when more than one page needs it. Add `hooks/` modules there when repeated React state/effect behavior emerges; avoid empty placeholder files.

## Backend

```text
server/src/
  app.ts                   # Express app and middleware composition
  server.ts                # Environment loading and HTTP listener
  constant.ts              # Shared routine/day constants
  controllers/
    auth/
    analytics/
    notifications/
    routine/
    weight/
    wellness/
    workout/
  db/
    db.ts                  # MongoDB connection
  middlewares/             # Async route wrapper and error handling
  models/
    auth/
    notifications/
    routine/
    weight/
    wellness/
    workout/
  routes/
    auth/
    routes.ts              # Auth and central API endpoint definitions
  services/
    auth/
    analytics/
    notifications/
    routine/
    weight/
    wellness/
    workout/
  workers/                 # Background email/notification work
  tests/                   # Backend validation and service tests
  utils/                   # Request validation, import mapping, helpers
```

This follows the EMS controller/model/routes/middleware/utils/db organization. Controllers validate requests and return responses; services own domain operations; models define persistence; the central router maps URLs to controllers. Keep each domain's controller, service, and model in its matching subfolder. Put cross-domain infrastructure in `middlewares/` or `utils/`.

## Growth conventions

- Add a new screen in `client/src/pages/<area>/` and its shared navigation entry in `Layout.tsx`.
- Add backend controllers, services, and models in matching domain folders, then register endpoints in `server/src/routes/routes.ts`.
- Preserve existing API endpoint paths when files move so the frontend and deployment configuration keep working.
- Keep React/Vite as the mobile and desktop app. It can be installed as a PWA and deployed as static files on a free frontend host. Electron would add a separate desktop package and release process without helping mobile deployment.
