# Crew Job Tracker — Frontend

The React 19 + Vite + Tailwind CSS v4 single-page app for Crew Job Tracker.

This repository contains **only the frontend**. It talks to a separately
running, private Crew Job Tracker API. It is **not** a recipe for self-hosting
the backend, and it does not include any backend code or backend history.

## Requirements

- Node.js (a current LTS or newer) and npm
- A reachable Crew Job Tracker API (local or remote)

## Local development

```bash
npm ci
npm run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:5555` (see
`vite.config.js`), so with an API running locally on that port the app works
with no extra configuration.

## API base URL (`VITE_API_BASE`)

API requests are built from root-relative paths (`/api/...`) joined onto
`VITE_API_BASE` (see `src/utils/apiBase.js`).

- **Empty or unset** (default): requests stay relative (`/api/...`). Use this
  for local development through the Vite proxy, or when the frontend is served
  from the same origin as the API.
- **Static deploy**: set the value when building, e.g.

  ```bash
  VITE_API_BASE=https://api.crewjobtrack.com npm run build
  ```

`VITE_API_BASE` is read at **build time** and baked into the bundle, so
changing the API host requires a rebuild. All `VITE_*` values are public — they
end up in the JavaScript shipped to browsers. Never put secrets in them.

## Scripts

| Command          | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `npm run dev`    | Start the Vite dev server                            |
| `npm test`       | Run the `joinApiBase` unit tests behind `apiUrl` (`node --test`) |
| `npm run lint`   | Run ESLint                                           |
| `npm run build`  | Production build into `dist/`                        |
| `npm run preview`| Serve the built `dist/` locally                      |

## Deploying as a Render Static Site

- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`
- **Environment variable (production build):**
  `VITE_API_BASE=https://api.crewjobtrack.com`
- **Rewrite rule (SPA routing):** source `/*` → destination `/index.html`,
  action *Rewrite*.

The API must list this frontend's origin in its trusted CORS origins
(`CORS_ORIGINS`). That is configured on the API service, not in this repo.

### Cookie / preview caveat

Authentication uses `SameSite=Lax` cookies set by the API.

- A preview frontend on `*.onrender.com` calling `api.crewjobtrack.com` is
  **cross-site**, so the auth cookies will not stick. Failing to stay logged in
  from such a preview is expected and is **not** a valid acceptance test of the
  production setup.
- The final setup — `crewjobtrack.com` calling `api.crewjobtrack.com` — is
  same-site (cross-origin), which is what the cookie policy is designed for.

## Notes

- The package name in `package.json` is still `client` (its name inside the
  original monorepo). It was kept as-is to avoid lockfile churn; it is
  `private` and never published to npm.
- **License:** no LICENSE file is included in this snapshot. The owner must
  decide on licensing before publishing this repository publicly. Until then,
  no license is granted.
