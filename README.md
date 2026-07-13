# Finance Tracker

A full-stack personal finance tracker with a React frontend, Express backend, and Turso-backed data storage. It includes income/expense management, dashboards, CSV export, and a trip splitter with debt settlement.

## Features
- Income and expense entry with edit/delete support
- Dashboard with summary cards and charts
- Trends comparison page
- CSV export for custom ranges
- Trip management and settlement planning
- Mobile-first responsive layout

## Setup

### 1) Install dependencies
```bash
cd client && npm install
cd ../server && npm install
cd ../sync && npm install
```

### 2) Configure Turso
Create a free database:
```bash
npm install -g @turso/cli
turso login
turso db create finance-tracker
```

Then get your database URL and auth token:
```bash
turso db show finance-tracker --url
turso db tokens create finance-tracker
```

Create a `.env` file in the project root:
```env
TURSO_DATABASE_URL=your-db-url
TURSO_AUTH_TOKEN=your-auth-token
PORT=3001
```

### 3) Run locally
Build the frontend and start the API:
```bash
cd client && npm run build
cd ../server && npm start
```

The app will be available at `http://localhost:3001`.

### 4) Sync local mirror
Run the local sync utility to create a mirror in `local-data/finance.db`:
```bash
cd sync && node pull.js
```

You can schedule it with:
- Windows Task Scheduler
- macOS launchd
- Linux cron

Example cron entry (every 15 minutes):
```cron
*/15 * * * * cd /path/to/project/sync && node pull.js >> sync.log 2>&1
```

## Render / Fly.io deployment
### Render
1. Push the repo to GitHub.
2. Create a new Render Web Service.
3. Connect the GitHub repo.
4. Set the build command to `cd client && npm install && npm run build && cd ../server && npm install`.
5. Set the start command to `cd server && npm start`.
6. Add the environment variables `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `PORT`.
7. Deploy.

### Keep the service warm
Render free tier sleeps after inactivity. To keep it awake, ping it every 10 minutes with UptimeRobot or cron-job.org.

## Notes
- The app uses a Turso cloud database for the live app and a local SQLite mirror when available.
- The trip splitter uses a standard debt simplification algorithm to produce a minimal settlement plan.
# khorcha-app
