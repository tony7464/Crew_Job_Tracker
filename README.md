# Crew Job Tracker

Crew Job Tracker is a simple app for owners of small cleaning and service businesses. It keeps clients, scheduled jobs, and unpaid work in one place, so you can stop tracking everything on paper and in text messages.

Read the [project pitch](project1-pitch.pdf) for the problem, users, and plan.

## Screenshots

![Login](docs/screenshots/login.png)

![Dashboard](docs/screenshots/dashboard.png)

![Jobs](docs/screenshots/jobs.png)

![Client detail](docs/screenshots/client-detail.png)

## Quick start

Install [Node.js 18 or newer](https://nodejs.org/) and [Python 3.10 or newer](https://www.python.org/downloads/), then run:

```bash
git clone https://github.com/tony7464/Crew_Job_Tracker.git
cd Crew_Job_Tracker
npm run setup
npm start
```

Open http://localhost:5000 and sign in with username `demo` and password `password123`. Setup installs what the app needs and adds sample clients and jobs the first time the database is empty. Press Ctrl+C to stop the app.

## Features

- Sign up, log in, and log out
- Add, edit, and delete clients
- Add, edit, and delete jobs
- Weekly dashboard with this week's schedule and unpaid jobs
- Pagination on long client and job lists
- Each person only sees their own clients and jobs

## Tech stack

- **Frontend:** React, React Router, and Vite
- **Backend:** Python and Flask
- **Database:** SQLite by default, or PostgreSQL when `DATABASE_URL` is set

## API routes

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/signup` | Create an account and log in |
| POST | `/api/login` | Log in |
| DELETE | `/api/logout` | Log out |
| GET | `/api/check_session` | Return the logged-in user |
| GET | `/api/clients` | List your clients |
| POST | `/api/clients` | Add a client |
| GET | `/api/clients/<id>` | Get one client and their jobs |
| PATCH | `/api/clients/<id>` | Update a client |
| DELETE | `/api/clients/<id>` | Delete a client and their jobs |
| GET | `/api/jobs` | List your jobs |
| POST | `/api/jobs` | Add a job |
| GET | `/api/jobs/<id>` | Get one job |
| PATCH | `/api/jobs/<id>` | Update a job |
| DELETE | `/api/jobs/<id>` | Delete a job |
| GET | `/api/dashboard` | This week's jobs and unpaid jobs |

## Testing

With the app running (`npm start`), run the Postman collection:

```bash
npx newman run server/postman_collection.json
```

## For developers

`npm run dev` starts the API and a website that reloads when you change the code. Press Ctrl+C to stop both.

Copy `server/.env.example` to `server/.env` to set:

- `SECRET_KEY` — a long random string used to sign login sessions
- `DATABASE_URL` — a PostgreSQL address. Leave it unset to use SQLite (`server/app.db`)
