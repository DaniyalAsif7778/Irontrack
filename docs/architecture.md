# IronTrack project structure

IronTrack follows the Employee Management System project's folder structure. Frontend screens are grouped under `pages/`, reusable UI lives under `components/ui/`, and API helpers have a dedicated `lib/api/` folder. The backend uses domain folders for controllers and models, with a central router, middleware, utilities, and database connection module.

## Frontend

```text
client/src/
  App.tsx                 # App state and page selection
  Layout.tsx              # Responsive desktop/mobile app shell
  components/
    components.ts          # Shared UI exports
    ui/                    # Shared metric, navigation, and timer components
  pages/
    analytics/             # Analytics page
    home/                  # Dashboard page
    routine/               # Routine page and its private components
      components/
    schedules/             # Schedule editor
    settings/              # Account and training preferences
    weight/                # Weight tracking page
    workout/               # Workout plans and logging page
    pages.ts               # Page exports
  import.ts                # Re-export UI and pages for app-level imports
  hooks/                   # Reusable React hooks (add when needed)
  lib/
    api/                   # API client
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
    import/
    routine/
    weight/
    workout/
  db/
    db.ts                  # MongoDB connection
  middlewares/             # Async route wrapper and error handling
  models/
    auth/
    routine/
    weight/
    workout/
  routes/
    routes.ts              # Central API endpoint definitions
  services/
    auth/
    analytics/
    import/
    routine/
    weight/
    workout/
  tests/                   # Existing backend tests
  utils/                   # Request validation, import mapping, helpers
```

This follows the EMS controller/model/routes/middleware/utils/db organization. Controllers validate requests and return responses; services own domain operations; models define persistence; the central router maps URLs to controllers. Keep each domain's controller, service, and model in its matching subfolder. Put cross-domain infrastructure in `middlewares/` or `utils/`.

## Growth conventions

- Add a new screen in `client/src/pages/<area>/` and its shared navigation entry in `Layout.tsx`.
- Add backend controllers, services, and models in matching domain folders, then register endpoints in `server/src/routes/routes.ts`.
- Preserve existing API endpoint paths when files move so the frontend and deployment configuration keep working.
- Keep React/Vite as the mobile and desktop app. It can be installed as a PWA and deployed as static files on a free frontend host. Electron would add a separate desktop package and release process without helping mobile deployment.
