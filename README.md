# Discord Activity Intelligence Bot + Dashboard

A full-stack instructor control center for monitoring Discord study/work sessions. The bot tracks voice attendance, text activity, reactions, and participation. The Next.js dashboard provides a real-time control panel with guided actions, logs, session management, and a command terminal.

---

## Architecture

```
Discord Bot (runtime authority)          Next.js Dashboard (operator console)
─────────────────────────────           ──────────────────────────────────────
• Discord client                         • /control  — session start/end/manage
• Voice/text event tracking              • /sessions — session list + history
• Session lifecycle + timers             • /users    — tracked user analytics
• Attendance + participation             • /logs     — real-time log viewer
• SQLite writes                          • /terminal — command execution
• HTTP API server (:4000)                • /commands — bot command registry
                        ↕ Bot API (x-api-key)
                  Shared SQLite DB (data.db)
```

**Data flow:**
1. Dashboard UI → Next.js API route
2. Next.js API route → Bot HTTP API (port 4000)
3. Bot executes action → writes to SQLite
4. Dashboard reads SQLite (readonly) for analytics/history

---

## Quick Start

### 1. Configure environment

Bot `.env`:
```
BOT_API_PORT=4000
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
DISCORD_TOKEN=your_token_here
```

Dashboard `dashboard/.env.local`:
```
BOT_API_URL=http://127.0.0.1:4000/api
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
NEXT_PUBLIC_API_BASE=/api
```

### 2. Start the bot
```bash
# From project root
node index.js
```
Bot starts on port 4000. You'll see:
```
[API] Internal server running on http://127.0.0.1:4000
```

### 3. Start the dashboard
```bash
cd dashboard
npm run dev
# or: pnpm dev
```
Dashboard runs on http://localhost:3000

---

## Demo Walkthrough

### Step 1: Open dashboard
Navigate to http://localhost:3000. You'll see:
- Overview page with DB stats (sessions, logs, users)
- System status banner shows DB connected

### Step 2: Go to Session Control
Navigate to `/control`. You'll see:
- **Bot API Online** banner (green) if bot is running
- **Bot API Offline** banner (red) with instructions if not

### Step 3: Select a server
- The guild dropdown auto-loads from the bot's Discord client cache
- If the bot is in one server, it auto-selects

### Step 4: Select a voice channel
- Voice channel dropdown loads after server is selected
- Shows member count for each channel
- Shows live members in selected channel (name + count)

### Step 5: Start a session
- Select duration (25 / 45 / 60 / 90 min or Custom)
- Optionally select a Report Channel (text channel for announcements)
- Click **Start Session**
- Result shows: session ID, channel, duration, initial participants

### Step 6: View active session card
- Active session appears immediately in the right panel
- Shows live countdown timer
- Shows started-by, duration, channel

### Step 7: Check Quick Actions (below the form)
8 guided action cards:
- **Health Check** — ping bot runtime + Discord state
- **List Active Sessions** — shows all running sessions
- **Check Database** — table count, row counts
- **Check Permissions** — verifies bot Discord perms
- **Sync Voice Members** — snapshot current channel members
- **Generate Report** — report last ended session
- **End All Sessions** — force-end all (dangerous, clearly marked)
- **Open Terminal** — navigate to terminal with context

### Step 8: View logs
Navigate to `/logs`:
- Real-time log viewer from SQLite `logs` table
- Filter by level (info, warn, error, debug, success)
- Filter by source
- Search
- Auto-refresh every 10s

### Step 9: View sessions
Navigate to `/sessions`:
- Active sessions at top with live pulse indicator
- Historical sessions in table with participant counts, voice minutes, avg score
- Click any session for detail page

### Step 10: Open terminal
Navigate to `/terminal`:
- Context selector at top (server, voice channel, text channel)
- Selected context is automatically injected into commands
- Command history (↑/↓), Tab autocomplete
- Shows output, execution ms, logs, rerun button
- Raw JSON expandable for data inspection

Try: `!health-check`, `!bot-status`, `!session-status`

### Step 11: End a session
From `/control`, click **End Session** on an active session card.
Or from the terminal: `!session-end`

### Step 12: View session detail
Navigate to `/sessions` → click Detail → for any session, shows:
- Status, duration, participants
- Attendance summary
- Participation scores
- Voice events timeline

---

## API Reference

### Dashboard → Bot API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Bot runtime health |
| GET | `/api/discord/guilds` | All guilds bot is in |
| GET | `/api/discord/guilds/:guildId/voice-channels` | Voice channels + members |
| GET | `/api/discord/guilds/:guildId/text-channels` | Text channels |
| GET | `/api/discord/guilds/:guildId/members` | Guild members |
| POST | `/api/actions/session/start` | Start a session |
| POST | `/api/actions/session/end` | End a session |
| POST | `/api/actions/session/report` | Generate session report |
| GET | `/api/actions/list-sessions` | List active sessions |
| GET | `/api/actions/db-status` | Database status |
| GET | `/api/actions/check-permissions` | Bot permission check |
| POST | `/api/actions/sync-voice-members` | Sync voice channel members |
| POST | `/api/execute` | Execute any bot command |
| GET | `/api/commands` | Command registry |

### Dashboard Next.js API Routes

| Path | Description |
|------|-------------|
| `/api/system/health` | Proxies bot health |
| `/api/discord/guilds` | Proxies guilds |
| `/api/discord/guilds/[guildId]/voice-channels` | Proxies voice channels |
| `/api/discord/guilds/[guildId]/text-channels` | Proxies text channels |
| `/api/discord/guilds/[guildId]/members` | Proxies members |
| `/api/actions/session/start` | Proxies session start |
| `/api/actions/session/end` | Proxies session end |
| `/api/actions/quick` | Unified quick-action proxy |
| `/api/execute` | Proxies command execution |
| `/api/sessions` | Reads SQLite sessions (readonly) |
| `/api/sessions/[id]` | Session detail from SQLite |
| `/api/logs` | Reads SQLite logs (readonly) |
| `/api/users` | Reads SQLite users (readonly) |

---

## Session Start Payload

```json
{
  "guildId": "1498223573565964440",
  "voiceChannelId": "123456789",
  "textChannelId": "987654321",
  "durationMinutes": 60,
  "requestedBy": "dashboard-admin",
  "source": "dashboard"
}
```

---

## Troubleshooting

### Next.js params error (fixed)
If you see: `Route used params.guildId. params is a Promise`
→ Already fixed. All dynamic routes now use `await context.params`.

### Terminal crash (fixed)
If you see: `Cannot read properties of undefined (reading 'length')`
→ Already fixed. All entry fields are normalized with safe defaults.

### Bot API offline
- Symptom: Red "Bot API Offline" banner on /control
- Fix: Run `node index.js` from project root
- Dashboard DB pages (/logs, /sessions, /users) still work offline

### DB path mismatch
- Symptom: "Database not found" on overview page
- Fix: Set `DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db` in `dashboard/.env.local`

### API key mismatch
- Symptom: 401 errors in bot API logs
- Fix: Ensure `BOT_API_KEY` matches in both `.env` (bot) and `dashboard/.env.local`

### No Discord channels in dropdown
- Symptom: Empty channel dropdowns on /control
- Fix: Bot must be in the Discord server and have ViewChannel permissions
- Run "Check Permissions" quick action to diagnose

### Terminal result shows no output
- Symptom: Empty output after command execution
- Cause: Bot returned output inside `.data.output`, dashboard now normalizes this
- Already fixed in `/api/execute` route

### Missing bot permissions
- Symptom: "Check Permissions" shows missing permissions
- Fix: Reinvite bot with correct permission scopes in Discord Developer Portal

---

## File Structure

```
project/
├── core/
│   ├── apiServer.js          # Bot HTTP API server (port 4000)
│   └── commandExecutor.js    # Command execution engine
├── modules/sessions/
│   └── sessionService.js     # Session lifecycle management
├── models/                   # SQLite model layer
├── commands/                 # Bot command registry
├── dashboard/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx      # Overview
│   │   │   ├── control/      # Session Control (main operator console)
│   │   │   ├── sessions/     # Session list + history
│   │   │   ├── terminal/     # Command terminal
│   │   │   ├── logs/         # Log viewer
│   │   │   └── users/        # User analytics
│   │   └── api/
│   │       ├── actions/      # Session start/end/quick proxy routes
│   │       ├── discord/      # Guild/channel/member proxy routes
│   │       ├── execute/      # Command execution proxy
│   │       ├── sessions/     # SQLite session reads
│   │       ├── logs/         # SQLite log reads
│   │       └── users/        # SQLite user reads
│   └── server/
│       ├── db/               # SQLite connection (readonly)
│       └── repositories/     # DB query functions
└── data.db                   # Shared SQLite database
```
