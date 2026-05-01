# 🤖 Discord Session Intelligence Bot

> **Automate attendance, measure participation, and get instant session summaries — directly in Discord.**

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat&logo=discord)](https://discord.js.org/)
[![Status](https://img.shields.io/badge/status-MVP%20in%20development-yellow)](#)

---

## 🧠 Introduction

This bot is a **solo graduation + internship project** designed to help instructors automatically monitor live study or work sessions inside Discord. Instead of manually tracking who showed up, who participated, and what happened, the bot captures real-time behaviour directly from voice and text channels — and produces clean, structured insights after every session.

---

## 🏗️ Architecture Overview

The bot uses an **event-driven, modular architecture** built around a central event bus.

### Event Bus

All domain events flow through `core/eventBus.js` (Node.js EventEmitter). Modules subscribe to events — no direct coupling between producers and consumers.

**Events:**
| Event | Emitted By | Consumed By |
|-------|-----------|-------------|
| `VOICE_JOIN` | voiceHandler | attendanceService, activityLogger |
| `VOICE_LEAVE` | voiceHandler | attendanceService, activityLogger |
| `SESSION_STARTED` | sessionService | (future listeners) |
| `SESSION_ENDED` | sessionService | (future listeners) |

### Event Flow

```
Discord voiceStateUpdate → voiceHandler → eventBus.emit() → listeners
```

### Modules by Domain

```
modules/
  sessions/        → Session lifecycle (start, end, switch, timers)
  attendance/      → Voice attendance tracking (join/leave per session)
  voice/           → Discord voice event → event bus adapter
  users/           → Guild member sync to DB
  activity/        → Generic activity event logging
```

### Standard Event Payload

All events use a consistent payload format:

```json
{
  "userId": "string",
  "channelId": "string",
  "sessionId": "number|null",
  "timestamp": "ISO string"
}
```

---

## 🔑 Key Concepts

- **Session** — Voice channel scoped. One active session per channel. Auto-ends via timer or empty-channel grace.
- **Attendance** — First join per user per session. Recorded as attendee on `VOICE_JOIN`.
- **Voice Events** — Join/leave intervals tracked per user per session for duration analysis.
- **Activity Events** — Generic event storage (`activity_events` table) for future extensibility.

---

## 🎯 What Problem Does It Solve?

Instructors running daily Discord sessions waste hours on repetitive tasks:
- Manually taking attendance
- Trying to guess who was really engaged
- Forgetting what was discussed last week
- Having no easy way to view historical activity

**This bot eliminates all that manual work** by turning raw Discord activity into meaningful, structured data — automatically.

---

## ⚡ Features

- 🎙️ **Voice‑channel attendance** — accurate, based on real join/leave events
- 🛡️ **Permission guard** — only instructors can control sessions
- ⏱️ **Auto-end timers** — sessions close after configured duration
- 🏚️ **Empty channel detection** — auto-ends session when channel empties (with grace period)
- 🔄 **Session switching** — move tracking to a different voice channel
- 📊 **Session info** — view active/all sessions with attendee and event counts
- 🧾 **Activity event log** — generic event storage for future analysis
- ⚙️ **Event-driven architecture** — fully decoupled, scalable
- 🎓 **Attendance Classification** — automatically classifies users as `ON_TIME`, `LATE`, `LEFT_EARLY`, or `ABSENT` at session end based on configurable thresholds
- 🧪 **Chaos-Tested Reliability** — algorithmically handles overlapping/out-of-order Discord voice events via chronological interval merging

---

## 📦 Tech Stack

| Layer          | Technology            |
|----------------|-----------------------|
| Bot            | Node.js + discord.js v14 |
| Database       | SQLite (better-sqlite3) |
| Event System   | Node.js EventEmitter |
| Dashboard (future) | Next.js           |

---

## 🚧 Scalability Design

Adding new features requires **zero core refactoring**:

```js
// Example: modules/notifications/notificationService.js
const { eventBus, Events } = require('../../core/eventBus');

function register() {
    eventBus.on(Events.SESSION_STARTED, ({ sessionId, channelId }) => {
        // send notification
    });
}

module.exports = { register };
```

Then add one line to `modules/index.js` → done.

---

## 🚀 Getting Started (Run Locally)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Discord server where you have the `Manage Server` permission

### 1. Clone the Repository
```bash
git clone https://github.com/admatieh/Discord-Activity-Intelligence-Bot
cd Discord-Activity-Intelligence-Bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Rename `.env.example` to `.env` and fill in your token:

```env
DISCORD_TOKEN=your_bot_token_here
```

### 4. Invite the Bot to Your Server
Use the OAuth2 URL generator with the following permissions:
- Send Messages
- Read Message History
- Connect and Speak (if using voice tracking)
- Use Voice Activity (optional)

### 5. Run the Bot
```bash
npm start
```
You should see `Logged in as <BotName>#0000` in the console.

---

## 💡 Usage (Current Commands)

| Command | Action |
|---------|--------|
| `!ping` | Check if bot is responsive |
| `!session-start [minutes]` | Start tracking in your voice channel (default: 60 min) |
| `!session-end [all\|here\|id\|name]` | End a session |
| `!session-switch [here\|name]` | Move tracking to another voice channel |
| `!session-info [all\|open\|id]` | View session details |
| `!whoareyou` | Get details about the bot's purpose |
| `!whoami` | Check your identity |
| `!welcome` | Send a welcome message to the channel |

---

## 🛠️ Development Notes

- **Listeners must register once** — all modules use `initialized` guard pattern
- **Event payloads must stay consistent** — `{ userId, channelId, sessionId, timestamp }`
- **Session cache** — in-memory `Map<channelId, sessionId>` avoids repeated DB lookups
- **Error isolation** — each event listener is wrapped in try/catch so one failure doesn't affect others
- **Startup order** — DB → Models → Services → Event listeners → Discord login

---

## 🗺️ Roadmap

- [x] Bot setup with command handling
- [x] Voice channel attendance tracking
- [x] Persistent storage (SQLite)
- [x] Role‑based permission checks
- [x] Event-driven modular architecture
- [x] Session auto-end timers
- [x] Empty channel detection
- [x] Participation scoring & engagement classification
- [ ] Session summaries & export (CSV)
- [ ] Next.js dashboard for instructors
- [ ] Scheduled sessions (API triggers)

---

## 🤝 Contributing

This is a personal graduation project, but suggestions and improvements are welcome!
Feel free to open an issue or reach out with ideas.

---

## 📄 License

This project is for educational purposes. License details to be added soon.

---

## 🙏 Acknowledgements

- [discord.js](https://discord.js.org/) – powerful Node.js library
- Project designed with ❤️ for real‑world internship experience
