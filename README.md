# Crew Job Tracker

A small web app for tracking clients and the jobs you do for them. Each account sees only its own clients and jobs.

The React app in `client/` talks to the Flask API in `server/`. The API stores data in a SQLite file, `server/app.db`.

## What you can do

- Sign up, log in, and log out. The session is an HttpOnly cookie. Passwords are stored as bcrypt hashes.
- Add, edit, and delete clients.
- Open a client to see that client's job history.
- Create, update, and delete jobs through the API. The screens list jobs; they do not include a job form yet.

One user cannot read or change another user's records. A request for someone else's client or job returns 404.

## Requirements

- Python 3
- Node.js and npm

## API

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
flask --app server.app db upgrade -d server/migrations
flask --app server.app run --host 127.0.0.1 --port 5000
```

Leave that process running. The API is at `http://127.0.0.1:5000`.

`db upgrade` creates `server/app.db` from the migration in `server/migrations`. The `-d` flag points Flask-Migrate at that folder when you run commands from the project root.

## Client

In a second terminal, from the project root:

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

Vite proxies `/api` to `http://127.0.0.1:5000`, so the browser talks to one origin and the session cookie is sent with each API request. Start the API before the client.

## API routes

All routes are under `/api`.

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/signup` | no |
| POST | `/api/login` | no |
| DELETE | `/api/logout` | no |
| GET | `/api/check_session` | session |
| GET, POST | `/api/clients` | session |
| GET, PATCH, DELETE | `/api/clients/<id>` | session |
| GET, POST | `/api/jobs` | session |
| GET, PATCH, DELETE | `/api/jobs/<id>` | session |

Client and job routes require a logged-in session. `user_id` is taken from that session. Sending `user_id` or `password_hash` in a JSON body is rejected.

Job `status` is one of `scheduled`, `completed`, or `cancelled`. A new job defaults to `scheduled` and unpaid.

## API tests

With the API running, and with `ada` and `bob` not already in the database:

```bash
npx newman run server/postman_collection.json
```

The collection signs those users up, then checks validation and that Bob cannot access Ada's clients or jobs. If those usernames already exist, delete `server/app.db`, run `flask --app server.app db upgrade -d server/migrations` again, and rerun Newman.
