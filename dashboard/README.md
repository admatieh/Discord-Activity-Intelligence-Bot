# Instructor Dashboard

A clean, instructor-focused web dashboard for the Discord Activity Intelligence Bot.

Built with **Next.js 16** (App Router), **shadcn/ui**, **Tailwind CSS v4**, and **TypeScript**.

---

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- The **bot must be running** for any live data or actions to work
- The bot API must be accessible at `http://127.0.0.1:4000/api`

---

## Quick Start

```bash
# From the repo root:
cd dashboard
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Required Environment Variables

Create (or verify) `dashboard/.env.local`:

```env
# Server-side only — NEVER use NEXT_PUBLIC for these
BOT_API_URL=http://127.0.0.1:4000/api
BOT_API_KEY=local_dashboard_key_123

# Database path (documentation / reference)
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db

# Client-safe — just the Next.js proxy prefix
NEXT_PUBLIC_API_BASE=/api
```

> **Security**: `BOT_API_KEY` is **server-side only**. The browser never sees it.
> All browser calls go to `/api/...` Next.js proxy routes, which forward to the bot with the key attached server-side.

---

## Architecture

```
Browser
  └─→  /api/...  (Next.js API routes — server-side proxy)
          └─→  http://127.0.0.1:4000/api/...  (Bot API, with x-api-key header)
                    └─→  SQLite data.db
```

### Key files

| File | Purpose |
|---|---|
| `dashboard/lib/server/botApi.ts` | Server-side bot API client (`botGet` / `botPost`, timeouts, JSON parsing) |
| `dashboard/lib/server/botMappers.ts` | Normalizes bot payloads (sessions, schedule, reports, activity, logs) |
| `dashboard/lib/helpers.ts` | Client-side apiFetch, date/format helpers |
| `dashboard/lib/types.ts` | All TypeScript types |
| `dashboard/app/api/...` | Next.js proxy routes (all server-side) |
| `dashboard/app/(dashboard)/...` | Page components |
| `dashboard/components/...` | Shared UI components |

---

## Pages

### Workspace (main navigation)

| Page | Route | Description |
|---|---|---|
| Home | `/` | Bot status, active session, upcoming items, activity feed |
| Record Session | `/record` | Start or schedule a voice session |
| Scheduled | `/scheduled` | View, cancel, or run scheduled sessions/messages |
| Messages | `/messages` | Send or schedule Discord announcements |
| Reports | `/reports` | View and generate session reports |
| Participants | `/participants` | View tracked users and activity stats |
| Activity | `/activity` | Human-readable event feed |
| Setup Guide | `/setup` | Zero-to-hero setup, env reference, troubleshooting, live diagnostics |

### Advanced Tools

| Page | Route | Description |
|---|---|---|
| Command Terminal | `/advanced/terminal` | Execute bot commands directly |
| Command Explorer | `/advanced/commands` | Browse all available commands |
| System Health | `/advanced/system` | Bot status, DB tables, uptime |
| Technical Logs | `/advanced/logs` | Raw system logs (route planned; use `/api/logs` or Activity for now) |

---

## Command Terminal (Advanced)

- Route: **`/advanced/terminal`**
- The browser calls **`POST /api/execute`** only; Next.js attaches **`BOT_API_KEY`** server-side.
- Commands should use the same **`!`** prefix as in Discord (e.g. `!help`). The UI may normalize bare names to prefixed form.
- Pass **guild**, **text**, and **voice** channel IDs when testing channel-aware commands; the bot executor builds a safe mock context from those IDs.

---

## Bot API Proxy Routes

All dashboard API routes proxy to the bot server-side.

### System
- `GET /api/system/health` → Bot health + DB status combined
- `GET /api/system/database` → Database status only
- `GET /api/commands` → All bot commands
- `POST /api/execute` → Execute a bot command

### Discord
- `GET /api/discord/guilds` → List servers
- `GET /api/discord/guilds/[guildId]/voice-channels` → Voice channels
- `GET /api/discord/guilds/[guildId]/text-channels` → Text channels
- `GET /api/discord/guilds/[guildId]/members` → Guild members

### Sessions
- `GET /api/sessions` → All sessions
- `GET /api/sessions/active` → Currently active sessions
- `POST /api/actions/session/start` → Start a session now
- `POST /api/actions/session/end` → End a session
- `POST /api/actions/session/report` → Generate a report

### Scheduling
- `GET /api/actions/schedule` → All scheduled items
- `POST /api/actions/schedule/session` → Schedule a session
- `POST /api/actions/schedule/message` → Schedule a message
- `POST /api/actions/schedule/[id]/cancel` → Cancel an item
- `POST /api/actions/schedule/[id]/run-now` → Run immediately

### Messages
- `POST /api/actions/message/send` → Send a message now
- `GET /api/actions/message/deliveries` → Message delivery history

### Reports
- `GET /api/actions/reports` → All reports
- `GET /api/actions/reports/[sessionId]` → Report detail
- `POST /api/actions/reports/[sessionId]` → Post report to Discord

### Activity & Logs
- `GET /api/activity` → Activity feed
- `GET /api/logs` → System logs

### Participants
- `GET /api/participants` → Tracked users (falls back to guild members)

---

## Manual Test Checklist

Follow these steps to verify the full integration:

1. **Start the bot**: `node index.js` from the repo root
2. **Start the dashboard**: `cd dashboard && pnpm dev`
3. **Open**: [http://localhost:3000](http://localhost:3000)
3b. ✅ **Setup Guide** (`/setup`) — diagnostics run, guild/commands checks make sense when bot is up
4. ✅ Home page loads — Bot status shows **Online**
5. ✅ Home page — Database shows **Connected**
6. ✅ Sidebar footer shows green Bot / DB status dots
7. ✅ Record Session page — Discord server dropdown loads
8. ✅ Select server — Voice and text channel dropdowns load
9. ✅ Start Recording — session starts, success toast appears
10. ✅ Home page — Live Session card appears (after refresh)
11. ✅ Record Session — Schedule for later, pick a date/time → success
12. ✅ Scheduled page — scheduled session appears in list
13. ✅ Scheduled page — Cancel button opens confirm dialog → cancel works
14. ✅ Messages page — server + channel dropdowns load
15. ✅ Messages page — compose a message → Send now works
16. ✅ Messages page — compose → Schedule → appears in scheduled messages
17. ✅ Messages page — Recent deliveries shows sent message
18. ✅ Reports page — sessions with/without reports listed
19. ✅ Reports page — Generate Report button triggers generation
20. ✅ Reports page — View button opens report detail
21. ✅ Report detail — Participants table, metric cards shown
22. ✅ Report detail — Post to Discord sends report
23. ✅ Participants page — user list loads (tracked or live members)
24. ✅ Participants page — search and filter work
25. ✅ Activity page — event feed loads with real events
26. ✅ Advanced → Command Terminal — guilds load, command executes
27. ✅ Advanced → Command Explorer — all commands listed
28. ✅ Advanced → System Health — bot uptime, DB tables shown
29. ✅ Advanced → Technical Logs — log entries appear, export works

---

## Running Builds & Checks

```bash
# Type check
.\node_modules\.bin\tsc.cmd --noEmit

# Production build
pnpm run build

# Dev server
pnpm dev

# Lint (if eslint config present)
pnpm run lint
```

---

## Manual demo checklist

1. Start the bot (Discord client + API on port 4000).
2. From `dashboard/`, run `pnpm dev` (or `pnpm start` after `pnpm build`).
3. Open the dashboard in the browser.
4. Confirm **Home** shows bot online and database connected (or clear offline messaging if the API is down).
5. Confirm **DB path** on Advanced → System Health matches your `DATABASE_PATH` / bot `data.db`.
6. Open **Record Session** — guilds and voice/text channels load.
7. **Record session now** (or schedule for later with a future time in UTC via local datetime picker).
8. **Schedule session** from Record when “Schedule for later” is selected.
9. **Send message now** from Messages.
10. **Schedule message** from Messages with a future time.
11. **Scheduled** — list shows items; use **Cancel** and **Run now** where appropriate.
12. **Activity** — feed shows real events when the bot has emitted them.
13. **End session** (from bot or relevant workflow) then **Reports** → **Generate report** for a session id.
14. Open **report detail** — metrics and participants; **Post to Discord** with an optional text channel.
15. **Participants** — pick a server; list shows live Discord members (not historical DB users unless you add a future `/users` API).
16. **Advanced → Command terminal** — run a command with optional guild/channel context.
17. **Advanced → Command explorer** — browse metadata from `GET /api/commands`.
18. **Advanced → Technical logs** — raw `GET /api/logs` output with filters.

---

## Known Limitations

- **No authentication**: Dashboard is intended for **local/private instructor use only**. Anyone who can reach the dashboard URL has full access.
  - TODO: Add NextAuth.js or similar when deploying beyond local
  - Structure is role-aware (student/instructor/admin concepts exist) for future auth
- **Participants page**: Uses live Discord guild members for the selected server (`GET /api/discord/guilds/:id/members` via proxy). There is no bot `GET /api/users` today; tracked stats per user would require a future API or DB aggregation.
- **Bot must be running**: All live actions (session start, messages, etc.) require the bot to be online. Stored data (reports, session history) may still be viewable if the bot is temporarily offline.
- **Session ID route**: The `[sessionId]` dynamic route requires Next.js 16 async params — already implemented correctly.

---

## Auth Note

> ⚠️ **This dashboard has no authentication.**
> It is designed for local/private instructor use until authentication is added.
> Do not expose the dashboard port publicly without adding authentication first.

---

## Environment Security

- `BOT_API_KEY` is **never** exposed to the browser
- `BOT_API_URL` is **never** exposed to the browser
- All API calls from the browser go to `/api/...` (same-origin Next.js routes)
- Next.js API routes proxy to the bot with `x-api-key` attached server-side
- Do **not** prefix secret config with `NEXT_PUBLIC_`
