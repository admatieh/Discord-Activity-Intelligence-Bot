# Discord Activity Intelligence Bot + Dashboard

A full-stack instructor control center for monitoring Discord study/work sessions. The bot tracks voice attendance, text activity, reactions, and participation. The Next.js dashboard provides a real-time instructor workspace with session recording, scheduling, messaging, reports, activity feed, and a command terminal.

---

## Architecture

```
Discord Bot (runtime authority)          Next.js Dashboard (instructor workspace)
─────────────────────────────           ──────────────────────────────────────────
• Discord client                         • Home         — overview + quick actions
• Voice/text event tracking              • Record       — session start/end
• Session lifecycle + timers             • Scheduled    — upcoming sessions/messages
• Attendance + participation             • Messages     — send/schedule messages
• Scheduler (polls every 20s)            • Reports      — real session reports
• Message delivery                       • Participants — voice member tracking
• Report generation                      • Activity     — real activity feed
• SQLite writes via services             • Advanced     — command terminal
• HTTP API server (:4000)
                        ↕ Bot API (x-api-key)
              DATABASE_PATH → shared SQLite (data.db)
```

**Data flow:**
1. Dashboard UI → Next.js API route (proxy)
2. Next.js API route → Bot HTTP API (port 4000)
3. Bot executes action → writes to SQLite + Discord
4. Dashboard reads activity/logs/reports via bot API

---

## Quick Start

### 1. Configure environment

**Bot `.env`** (project root):
```
TOKEN=your_discord_bot_token_here
BOT_API_PORT=4000
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
```

**Dashboard `dashboard/.env.local`**:
```
BOT_API_URL=http://127.0.0.1:4000/api
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
NEXT_PUBLIC_API_BASE=/api
```

> ⚠️ Both must use the **same** `DATABASE_PATH`. The bot logs the actual path on startup.

### 2. Start the bot
```bash
node index.js
```
You'll see:
```
[DATABASE] Using DB path: C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
[DATABASE] Schema ready. All tables initialized.
[API] Internal server running on http://127.0.0.1:4000
[SYSTEM] Bot ready as YourBot#1234
[Scheduler] Initialized. Polling every 20s.
```

### 3. Start the dashboard
```bash
cd dashboard
npm run dev
```
Dashboard runs on http://localhost:3000

---

## Database Schema

The shared `data.db` contains:

| Table | Purpose |
|---|---|
| `sessions` | Recording sessions (title, guild, channels, status) |
| `attendees` | Session attendee mapping |
| `voice_events` | Raw join/leave events per session |
| `voice_activity_intervals` | Speaking intervals |
| `attendance_summary` | Finalized attendance per session |
| `participation_summary` | Participation scores |
| `users` | Discord user cache |
| `logs` | Bot system logs (enhanced columns) |
| `activity_events` | Human-readable activity events |
| `scheduled_items` | Future sessions + messages |
| `message_deliveries` | Message send history |
| `session_reports` | Generated report JSON |

### DATABASE_PATH priority
```js
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
```
Bot always logs the actual path used on startup.

---

## Bot API Endpoints

All endpoints require `x-api-key` header.

### System
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Bot runtime health |
| GET | `/api/system/runtime` | Full runtime stats |
| GET | `/api/system/database` | DB path + tables + counts |
| GET | `/api/actions/db-status` | DB health check |
| GET | `/api/actions/check-permissions` | Bot Discord permissions |

### Discord
| Method | Path | Description |
|---|---|---|
| GET | `/api/discord/guilds` | All guilds |
| GET | `/api/discord/guilds/:id/voice-channels` | Voice channels + members |
| GET | `/api/discord/guilds/:id/text-channels` | Text channels |
| GET | `/api/discord/guilds/:id/members` | Guild members |

### Sessions
| Method | Path | Description |
|---|---|---|
| POST | `/api/actions/session/start` | Start session (structured) |
| POST | `/api/actions/session/end` | End session |
| GET | `/api/sessions` | All sessions |
| GET | `/api/sessions/active` | Active sessions |
| GET | `/api/sessions/:id` | Session by ID |
| GET | `/api/actions/list-sessions` | Active sessions (legacy) |
| POST | `/api/actions/sync-voice-members` | Sync voice members |

### Scheduling
| Method | Path | Description |
|---|---|---|
| POST | `/api/actions/schedule/session` | Schedule a future session |
| POST | `/api/actions/schedule/message` | Schedule a future message |
| GET | `/api/actions/schedule` | List scheduled items |
| GET | `/api/actions/schedule/:id` | Get scheduled item |
| POST | `/api/actions/schedule/:id/cancel` | Cancel scheduled item |
| POST | `/api/actions/schedule/:id/run-now` | Execute immediately |

### Messages
| Method | Path | Description |
|---|---|---|
| POST | `/api/actions/message/send` | Send message now |
| GET | `/api/actions/message/deliveries` | Message delivery history |

### Reports
| Method | Path | Description |
|---|---|---|
| POST | `/api/actions/session/report` | Generate report |
| GET | `/api/actions/reports` | List all reports |
| GET | `/api/actions/reports/:sessionId` | Get report by session |
| POST | `/api/actions/reports/:sessionId/post` | Generate + post to Discord |

### Activity & Logs
| Method | Path | Description |
|---|---|---|
| GET | `/api/activity` | Unified activity feed |
| GET | `/api/logs` | System logs |

---

## Scheduler

The scheduler polls the `scheduled_items` table every **20 seconds**.

### How it works
1. On bot ready → `initScheduler(client)` called
2. Immediately executes any due jobs from before restart
3. Stale "running" jobs (>5 min) are reset to "scheduled"
4. Duplicate execution prevented via in-memory lock

### Schedule a session
```json
POST /api/actions/schedule/session
{
  "guildId": "...",
  "voiceChannelId": "...",
  "textChannelId": "...",
  "title": "Study Session",
  "scheduledFor": "2026-05-09T14:00:00.000Z",
  "durationMinutes": 60,
  "requestedBy": "instructor"
}
```

### Schedule a message
```json
POST /api/actions/schedule/message
{
  "guildId": "...",
  "textChannelId": "...",
  "content": "Session starts in 10 minutes!",
  "scheduledFor": "2026-05-09T13:50:00.000Z"
}
```

---

## Message Sending

```json
POST /api/actions/message/send
{
  "guildId": "...",
  "textChannelId": "...",
  "content": "Hello everyone!",
  "requestedBy": "instructor"
}
```

Validates: content length (≤2000), channel exists, is text-based, bot can send.

---

## Activity Feed

```
GET /api/activity?limit=100
GET /api/activity?sessionId=42
GET /api/activity?guildId=...&type=SESSION_STARTED
```

Returns human-readable entries combining `activity_events` and error logs:
```json
{
  "id": "ae_123",
  "timestamp": "2026-05-08T...",
  "type": "SESSION_STARTED",
  "label": "Recording session started",
  "severity": "info",
  "sessionId": 42
}
```

---

## New Discord Commands

| Command | Description |
|---|---|
| `!schedule-session --channel <id> --at "<datetime>" --duration 60 --title "..."` | Schedule a future session |
| `!scheduled [--type session\|message] [--status scheduled]` | List scheduled items |
| `!cancel-scheduled --id <itemId>` | Cancel a scheduled item |
| `!send-message --channel <id> --content "..."` | Send message immediately |
| `!schedule-message --channel <id> --at "<datetime>" --content "..."` | Schedule a message |
| `!activity [--limit 20] [--session <id>]` | Show activity feed |

---

## Troubleshooting

### DB path mismatch
Bot logs: `[DATABASE] Using DB path: ...`
- Ensure `DATABASE_PATH` is set in both `.env` and `dashboard/.env.local`
- Both must point to the same absolute path

### Bot API offline
- Run `node index.js` from project root
- Check port 4000 isn't blocked

### Scheduler not running jobs
- Check `scheduled_for` is a valid ISO datetime
- Scheduled time must be in the future
- Bot must be running; scheduler starts on `ready` event

### Report is empty
- Report needs `voice_events` data — session must have had voice activity
- If `attendance_summary` is empty, report falls back to computing from raw voice events

### Logs missing
- Dashboard `/api/logs` proxies through bot API (requires bot running)
- Check `DATABASE_PATH` env var

### API key mismatch (401 errors)
- Ensure `BOT_API_KEY` matches in bot `.env` and `dashboard/.env.local`

---

## File Structure

```
project/
├── index.js                    # Bot entry + scheduler init
├── database/db.js              # SQLite init + schema + DATABASE_PATH
├── core/
│   ├── apiServer.js            # Bot HTTP API (port 4000) — all endpoints
│   └── commandExecutor.js      # Command execution engine
├── services/
│   ├── schedulerService.js     # Scheduler (polls DB, executes due items)
│   ├── messageService.js       # Send/schedule messages
│   ├── sessionActionService.js # Structured session workflows
│   ├── reportService.js        # Real report generation from DB
│   └── activityFeedService.js  # Unified human-readable activity feed
├── modules/sessions/
│   ├── sessionService.js       # Core session lifecycle
│   └── sessionSummaryService.js# Attendance summary
├── models/                     # SQLite model layer
├── commands/                   # Bot command registry
│   ├── session/schedule-session.js
│   ├── session/scheduled.js
│   ├── session/cancel-scheduled.js
│   ├── interaction/send-message.js
│   ├── interaction/schedule-message.js
│   └── system/activity.js
└── dashboard/
    └── app/api/
        ├── activity/           # Activity feed proxy
        ├── logs/               # Logs proxy (bot API)
        ├── sessions/active/    # Active sessions proxy
        └── actions/
            ├── schedule/       # Scheduling proxies
            ├── message/        # Message proxies
            └── reports/        # Report proxies
```
