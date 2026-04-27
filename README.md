# 🤖 Discord Session Intelligence Bot

> **Automate attendance, measure participation, and get instant session summaries — directly in Discord.**

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat&logo=discord)](https://discord.js.org/)
[![Status](https://img.shields.io/badge/status-MVP%20in%20development-yellow)](#)

---

## 🧠 Introduction

This bot is a **solo graduation + internship project** designed to help instructors automatically monitor live study or work sessions inside Discord. Instead of manually tracking who showed up, who participated, and what happened, the bot captures real-time behaviour directly from voice and text channels — and produces clean, structured insights after every session.

---

## 🎯 What Problem Does It Solve?

Instructors running daily Discord sessions waste hours on repetitive tasks:
- Manually taking attendance
- Trying to guess who was really engaged
- Forgetting what was discussed last week
- Having no easy way to view historical activity

**This bot eliminates all that manual work** by turning raw Discord activity into meaningful, structured data — automatically.

---

## 🔑 Key Concepts

- **Attendance Tracking** – Based on voice channel presence (join/leave times) with configurable grace periods. Classifies users as *present*, *late*, *absent* or *left early*.
- **Participation Scoring** – Measures engagement via message count, replies, and bot command usage. Labels users as *active*, *passive*, or *non-participating*.
- **Session Lifecycle** – One command to start, the bot tracks everything, and at the end produces a summary with attendance stats and engagement levels.
- **Instructor-Friendly** – Role‑based access ensures only instructors can start/end sessions. Everything is logged and later viewable via a web dashboard (coming soon).

---

## ⚡ Features

- 🎙️ **Voice‑channel attendance** — accurate, based on real join/leave events
- 💬 **Message‑based engagement scoring** — configurable weights for messages, replies, commands
- 🛡️ **Permission guard** — only instructors can control sessions
- 🧾 **Session summaries** — total attendees, engagement breakdown, top contributors
- 🧠 **In-memory state** (current MVP) — no database required for testing
- ⚙️ **Modular architecture** — easy to extend with new commands or tracking methods
- 📊 **Future dashboard** — built with Next.js for historical data visualization

---

## 📦 Tech Stack

| Layer          | Technology            |
|----------------|-----------------------|
| Bot            | Node.js + discord.js v14 |
| Dashboard (future) | Next.js           |
| Database (future)  | SQLite / PostgreSQL |
| Real-time tracking | Discord Gateway Intents (Guilds, Messages, VoiceStates) |

---

## 🚧 Current Status

> ✅ **MVP Phase 1** – The bot is alive, responds to commands, and tracks text-based attendance in memory.

**What already works:**
- `!start-session` / `!end-session` commands
- In-memory session & attendance storage (unique user Set)
- Basic validation (channel type, duplicate session)
- Modular command & event loader

**What’s being added next:**
- Voice channel attendance tracking (voiceStateUpdate event)
- Participation scoring based on message activity
- Persistent storage (SQLite)
- Instructor role validation
- Session summaries and data export


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
| `!start-session` | Start tracking attendance in the current text channel |
| `!end-session` | End the session and display total unique attendees |
| `!whoareyou` | Get details about the bot's purpose |
| `!welcome` | Send a welcome message to the channel |

> More commands (like `/summary`, `/report`) and voice tracking will be added in the next updates.

---

## 🗺️ Roadmap

- [x] Bot setup with basic command handling
- [x] In-memory session & text‑based attendance
- [ ] Voice channel attendance tracking
- [ ] Participation scoring & engagement classification
- [ ] Persistent data storage (SQLite)
- [ ] Role‑based permission checks
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

