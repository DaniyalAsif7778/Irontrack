# IronTrack tooling and package map

This is a React/Vite PWA with a separate Express/MongoDB API. The package manifests separate browser/server runtime code from build and test tooling. shadcn/ui is a component code distribution workflow, so its CLI is a development dependency while the generated components and their primitives ship with the client.

## Client workspace

### Runtime dependencies

| Package | Role in IronTrack |
| --- | --- |
| `react`, `react-dom` | App UI and browser rendering |
| `react-router-dom` | Route-based pages; each page has a shareable URL |
| `axios` | Shared HTTP client, timeout and API errors; local-storage demo remains available without `VITE_API_URL` |
| `@tanstack/react-query` | Remote data cache, loading state and mutation refresh |
| `zustand` | Small local UI state for selected date and analytics range |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Typed form state and field validation |
| `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot` | Theme-token utility styling and composable shadcn-style primitives |
| `lucide-react`, `sonner` | Icons and toast notifications |
| `@tanstack/react-table` | Headless table state for a later sortable/filterable history view; current weight history stays a simple responsive list |
| `recharts` | Analytics charts, loaded only when the Analytics route is opened |
| `date-fns` | Consistent date formatting in the routine and charts |
| `gsap` | Reserved for deliberate, user-triggered motion when a feature needs a timeline; no ambient animation is currently used |

### Development dependencies

`vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `postcss`, and `autoprefixer` build the client and compile styles. `shadcn` is the component generator; `components.json` points it at the existing Tailwind 3 configuration and theme tokens. `@tanstack/react-query-devtools` is rendered in development only. `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, and `@testing-library/jest-dom` are test-only. Run them with `npm run test -w irontrack-client`.

## Server workspace

### Runtime dependencies

| Package | Role / phase |
| --- | --- |
| `express`, `mongoose`, `dotenv`, `zod` | API, MongoDB models, environment config, request schemas |
| `cors`, `helmet`, `express-rate-limit`, `express-mongo-sanitize`, `cookie-parser` | CORS allowlist, HTTP security headers, API request limiting, Mongo operator filtering, cookie parsing |
| `morgan`, `pino` | Request logs and structured service/error logs |
| `jsonwebtoken`, `bcrypt` | Signed account sessions, password hashing and private per-account data |
| `multer`, `cloudinary` | Validated upload phase; no upload route is enabled yet |
| `nodemailer` | Email notifications phase; no mail provider is configured yet |
| `socket.io` | Real-time collaboration/updates phase; no socket server is started yet |
| `stripe` | Payments phase; no checkout/webhook endpoints are enabled |
| `swagger-ui-express` | API documentation phase; add only with a maintained OpenAPI document |

`tsx` and `typescript` are development/build dependencies. `vitest`, `supertest`, and `@types/*` packages are development-only. Run backend tests with `npm run test -w irontrack-server`.

Every data route requires a verified account session, and routine, weight, workout and analytics records are scoped by owner ID. Registration, sign-in, email verification, password recovery, and session review are account-based in every server environment; there is no server-side authentication bypass. The API also applies Helmet headers, a configured CORS origin list, JSON body limits, Mongo operator sanitization, API and auth rate limits, and Morgan-to-Pino logging. `CLIENT_ORIGIN` is a comma-separated list. Keep it specific to the deployed client URL. Set `TRUST_PROXY=1` only when hosted behind one trusted reverse proxy so IP-based rate limits use the client address.

## Phases

1. **Core tracking:** responsive PWA, routines, weight history, workout plans/logs, analytics, timer, and validated API.
2. **Accounts and privacy:** verified email accounts, rotating HttpOnly sessions, and per-account data in every server environment.
3. **Settings and personalization:** account profile, default weight unit, timer lengths, and browser notification permission.
4. **Next work:** design and implement offline reads/writes with an explicit conflict policy, then add sync status and cross-device recovery. Current data entry requires a live API connection.
5. **Optional services:** enable uploads, mail, realtime or billing only when matching product behavior is scoped, configured, and tested. Add OpenAPI documentation against actual route contracts.

## Free deployment recommendation

Use one responsive React PWA for phones and desktops. Keep Vite/React in the browser; Electron would add a desktop packaging and update channel without helping web hosting. A PWA can be installed from the browser on supported mobile and desktop platforms and can be deployed as static files.

Keep this as one React/Vite PWA for mobile and desktop; Electron adds a desktop packaging channel without helping web deployment. For free hosting with cookie-based sign-in, prefer one public site origin for both the client and `/api` (for example, serve the built client and Express API from one Render web service), with MongoDB Atlas Free for storage. A split static host and API can work, but needs a same-site API proxy for reliable browser cookies. Render free services sleep after 15 minutes idle and have prototype limits. Atlas Free clusters have shared limits including 0.5 GB storage and 100 operations/second; this setup suits a hobby prototype, not a production reliability promise.

## Official documentation

- [React Router installation](https://reactrouter.com/start/declarative/installation)
- [TanStack Query quick start](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- [TanStack Table introduction](https://tanstack.com/table/latest/docs/introduction)
- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [shadcn/ui theming and CSS variables](https://ui.shadcn.com/docs/theming)
- [Vitest component testing](https://vitest.dev/guide/browser/component-testing)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Render free service limits](https://render.com/docs/free)
- [MongoDB Atlas free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
