# Discord Activity Intelligence Bot + Dashboard

Discord Activity Intelligence Bot is a full-stack Discord-based session tracking and instructor workspace system. 

It helps instructors:
- Record live voice sessions
- Schedule future sessions
- Send and schedule text announcements
- Track student attendance and voice participation
- Generate session analytics and reports
- Review participants
- View a unified activity feed and system logs
- Use an elegant web dashboard for workflows instead of relying solely on raw commands

The dashboard serves as a complete **Instructor Workspace**, abstracting away raw Discord commands into an intuitive UI.

---

## Architecture Overview

The system operates in a split frontend-backend model:

1. **Discord Bot Runtime**: The core daemon running Discord.js and handling live tracking.
2. **Bot API Server**: A local Express.js server bound to port 4000 exposing bot functions.
3. **SQLite Database**: The centralized, shared data persistence layer.
4. **Scheduler Service**: Background polling service handling delayed events.
5. **Message/Session/Report Services**: Reusable logical modules.
6. **Command System**: Safe text command parser and executor.
7. **Next.js Dashboard**: The frontend interface for instructors.

**Data Flow**:
`Dashboard UI` → `Next.js API route` → `Bot local API server` → `Bot service/action` → `Discord + SQLite` → `Dashboard reads refreshed data`

**Architecture Rules**:
- The Bot owns the Discord runtime and **all writes/mutations** to the database.
- The Dashboard owns the UI and workflow orchestration.
- The Dashboard calls the bot API for all actions.
- The Dashboard reads data either directly from SQLite or through API proxies.
- SQLite (`data.db`) is the shared persistence layer between both the bot and the dashboard.

---

## Discord Server Setup

### 1. Create the Instructor Role
Create a Discord role named: **Instructor**

This role is used as the access badge for all instructor and admin bot commands. 
**Important**:
- The Instructor role does **NOT** need Administrator permission.
- It does **NOT** need Manage Roles.
- It does **NOT** need Manage Channels.

Recommended Instructor role permissions:
- View Channels (only if needed)
- Send Messages (only if needed)
- Read Message History (only if needed)
- Connect/Speak (if instructors participate in voice)
- No dangerous server-management permissions are required.

The bot checks whether a member has the Instructor role or the Administrator permission. Students without this role are blocked from executing instructor commands.

### 2. Configure Bot Role
The `SessionBot` role should be above the Instructor role in Discord’s role hierarchy if you want `!add-instructor` and `!remove-instructor` to work.
Role order should be:
1. SessionBot
2. Instructor
3. @everyone

The bot role needs:
- View Channels
- Send Messages
- Read Message History
- Manage Roles (only needed for `!add-instructor` / `!remove-instructor`)
- Connect
- Speak
- Use Voice Activity
- Administrator is **not** recommended unless strictly for local testing.

*Discord only lets bots assign/remove roles that are lower than the bot’s highest role.*

### 3. Channel Setup
Recommended channels:
- One or more voice channels for study/work sessions (e.g., `Study Room 1`, `Study Room 2`)
- One text channel for bot commands (e.g., `#bot-commands`)
- One optional text channel for session updates/reports (e.g., `#reports`)
- One optional private instructor channel

### 4. Student Safety Model
Students can use **only** public/self-service commands:
- `!help`
- `!whoami`
- `!my-attendance`
- `!my-participation`

Students **cannot**:
- Start/end sessions
- Schedule sessions
- Send/schedule messages
- View another user’s analytics
- Generate/view reports
- Manage instructors
- View technical logs

---

## Environment Configuration

Create a `.env` file in the root project directory:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=optional_dev_guild_id
BOT_API_PORT=4000
BOT_API_KEY=local_dashboard_key_123
BOT_API_URL=http://127.0.0.1:4000/api
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
INSTRUCTOR_ROLE_NAME=Instructor
INSTRUCTOR_ROLE_IDS=role_id_here
BOT_ADMIN_USER_IDS=discord_user_id_here
```

**Important Notes:**
- Prefer `INSTRUCTOR_ROLE_IDS` over role name for production. Role name acts as a fallback.
- `BOT_ADMIN_USER_IDS` can always add/remove instructors regardless of Discord roles.
- `DATABASE_PATH` should be absolute (especially on Windows) to avoid the bot and dashboard using different DB files.
- `BOT_API_KEY` is server-side only. Do not expose it in browser environments.

Create a `dashboard/.env.local` file:
```env
BOT_API_URL=http://127.0.0.1:4000/api
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
NEXT_PUBLIC_API_BASE=/api
```

---

## Installation / Running

**1. Install root dependencies:**
```bash
npm install
```

**2. Run bot:**
```bash
node index.js
# Or if package script exists:
npm run start
```
*Note: The bot must be running for live actions. The dashboard can show stored data if the bot is offline, but live actions will fail gracefully.*

**3. Run dashboard:**
```bash
cd dashboard
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Testing

This project utilizes two robust test harnesses:

**Bot System Tests**
```bash
npm run test:bot-system
```
Validates:
- DB schema/migrations
- Logs, Activity Feed, and Reports
- Scheduler
- Message service
- Session actions
- Service imports & response contracts

**Bot Command Tests**
```bash
npm run test:bot-commands
```
Validates:
- All commands load
- Metadata and Aliases
- Empty args / invalid args behavior
- Missing guild/voice context handling
- Dashboard command string routing
- Safe failures and graceful fallbacks

**Current Status**: 
- Backend services: 25 tests passed
- Commands: 61 commands, 148 scenarios passed
- Dashboard integration: in progress/current working state.

**Manual Tests Before Production:**
- Run `!help`, `!whoami`
- Test `!add-instructor @User` and `!remove-instructor @User`
- Test `!schedule-session` and `!send-message`
- Schedule a message for 1 minute later
- Start real session, join/leave voice, end session, generate report.

---

## Commands

### Public/Student Commands
- `!help` - Explore commands. Hides restricted commands from students.
- `!whoami` - Show your permissions and role.
- `!my-attendance` - View your own attendance history.
- `!my-participation` - View your own participation history.

### Instructor/Session Commands
- `!session-start`
- `!session-end`
- `!schedule-session`
- `!scheduled`
- `!cancel-scheduled`
- `!session-summary`
- `!activity`

### Messaging
- `!send-message`
- `!schedule-message`

### Admin
- `!add-instructor`
- `!remove-instructor`
- `!db-status`

**Examples:**
```text
!schedule-session --channel <voiceChannelId> --at "2026-05-10T14:30:00" --duration 45 --title "Group Focus Session"
!send-message --channel <textChannelId> --content "Hello everyone"
!schedule-message --channel <textChannelId> --at "in 10m" --content "Session starts soon"
!add-instructor @User
!remove-instructor @User
```
*Tip: Use channel IDs or channel mentions. Natural time parsing (like "in 10m" or "tomorrow 5pm") is fully supported.*

---

## Dashboard

The dashboard is intended to be the primary instructor workspace. Command Terminal and Command Explorer are advanced tools, not the primary workflow.

**Pages:**
- **Home**: Quick actions and active metrics
- **Record Session**: Live session control
- **Scheduled**: View and cancel scheduled events
- **Messages**: Announce or queue announcements
- **Reports**: View detailed PDF-style analytics
- **Participants**: Manage user lists
- **Activity**: Unified real-time event log
- **Advanced Tools**: Command execution environment

---

## Scheduling

Scheduled items are persisted in the `scheduled_items` table.
- The Scheduler polls every **20 seconds**.
- Due scheduled sessions/messages execute seamlessly through the bot runtime.
- Missed jobs after a restart are instantly handled on boot.
- One-time jobs are fully supported (recurrence column exists but not implemented yet).

**Timezones:** 
- `scheduled_for` is stored as a UTC ISO string in the DB.
- Dashboard should send UTC ISO strings.
- Discord commands support Natural Language Time parsing (e.g. `in 30m`), which handles timezone anchoring internally.

---

## Database

The project uses SQLite via `better-sqlite3`.

Main DB: `data.db`
Important tables:
- `sessions`, `users`, `logs`, `activity_events`
- `scheduled_items`, `message_deliveries`
- `session_reports`, `attendance_summary`, `participation_summary`
- `voice_events`

**Notes:**
- WAL mode is enabled for performance.
- Foreign keys are enabled.
- Safe migrations are automatically applied on startup.
- **Use absolute DATABASE_PATH** to avoid path mismatch between the Next.js process and Node.js bot process.

---

## Security / Permissions

**Security Model**:
- The **Instructor role** natively controls command access.
- **Discord Administrators** are natively allowed across all actions.
- `BOT_ADMIN_USER_IDS` can force-manage instructors.
- Students are strictly restricted to self-service commands.
- The Dashboard UI shares this exact backend permission model via bot proxying.
- `BOT_API_KEY` protects the local bot API from unauthorized system calls.
- Do **not** expose the `BOT_API_KEY` to the browser environment.
- The Bot API should stay localhost-bound for local/demo usage.

*For production deployment, add dashboard authentication before exposing the dashboard publicly over the internet.*

---

## Known Limitations
- Recurrence scheduling is not implemented yet.
- Dashboard auth may still be local/demo-focused.
- Live Discord behavior should be manually tested after changes.
- Bot must have proper role hierarchy to assign Instructor role.
- SQLite is suitable for local/demo/small deployments; larger multi-server production may require stronger DB planning.

---

## Troubleshooting

1. **Bot cannot add instructor**
   - *Cause*: Bot role is below Instructor role or lacks Manage Roles permission.
2. **Student can run instructor command**
   - *Cause*: Command missing `checkInstructor` or metadata. Audit the command.
3. **Dashboard says bot offline**
   - *Cause*: Bot not running, `BOT_API_URL` wrong, or `BOT_API_KEY` mismatch.
4. **Scheduled item does not run**
   - *Cause*: Bot not running, invalid scheduled time, timezone issue.
5. **Dashboard reads empty DB**
   - *Cause*: Bot and dashboard using different `DATABASE_PATH` values. Set an absolute path.
6. **send-message cannot find channel**
   - *Cause*: Wrong channel ID, bot lacks channel access, or it is not a text channel.
7. **schedule-session cannot find voice channel**
   - *Cause*: Wrong voice channel ID, bot lacks access, or channel is not cached/fetchable.

---

## Current Status
- Backend services securely tested ✅
- Commands strictly tested ✅
- Dashboard integration actively functioning in local dev ✅
