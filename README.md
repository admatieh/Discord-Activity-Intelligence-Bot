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

**Key Events:**
| Event | Emitted By | Consumed By |
|-------|-----------|-------------|
| `VOICE_JOIN` | voiceHandler | attendanceService, voiceActivityService |
| `VOICE_LEAVE` | voiceHandler | attendanceService, voiceActivityService |
| `VOICE_MUTE/UNMUTE` | voiceHandler | voiceActivityService |
| `MESSAGE_CREATE/REPLY` | messageHandler | interactionService |
| `SESSION_STARTED` | sessionService | activityLogger |
| `SESSION_ENDED` | sessionService | attendanceService, voiceActivityService |
| `ATTENDANCE_FINALIZED` | attendanceService | participationService |
| `PARTICIPATION_FINALIZED` | participationService | sessionSummaryService |

### Modules by Domain

```
modules/
  sessions/        → Session lifecycle, timers, and summary orchestration
  attendance/      → Voice attendance tracking & status classification
  participation/   → Participation scoring (0-100) & engagement analysis
  interaction/     → Text-based interaction tracking (messages, replies, reactions)
  activity/        → Generic event logging & voice activity interval tracking
  users/           → Guild member synchronization to DB
  voice/           → Discord voice event → event bus adapter
```

---

## 🔑 Key Concepts

- **Session** — Voice channel scoped. One active session per channel. Auto-ends via timer or empty-channel grace.
- **Attendance** — Users are classified as `ON_TIME`, `LATE`, `LEFT_EARLY`, or `ABSENT` based on configurable duration thresholds.
- **Participation Score** — A deterministic 0–100 score calculated from speaking ratio, interaction volume, and attendance status.
- **Interactions** — Tracking of messages, replies, and reactions to measure social engagement.

---

## ⚡ Features

- 🎙️ **Voice‑channel attendance** — accurate, based on real join/leave events.
- 📊 **Participation Scoring** — Evaluates engagement using weighted metrics:
  - **Speaking Time** (50%): Ratio of session spent unmuted.
  - **Interaction Volume** (30%): Count of messages, replies, and reactions.
  - **Attendance Status** (20%): Bonus for punctuality.
- 🛡️ **Permission guard** — only instructors can control sessions.
- ⏱️ **Auto-end timers** — sessions close after configured duration.
- 🏚️ **Empty channel detection** — auto-ends session when channel empties (with grace period).
- 🔄 **Session switching** — move tracking to a different voice channel seamlessly.
- ⚙️ **Event-driven architecture** — fully decoupled modules and scalable event handling.
- 🧪 **Stress Tested** — Validated via a "Chaos Test" simulating 80+ users with rapid joins/leaves and mute spam.

---

## 📦 Tech Stack

| Layer          | Technology            |
|----------------|-----------------------|
| Bot            | Node.js + discord.js v14 |
| Database       | SQLite (better-sqlite3) |
| Event System   | Node.js EventEmitter |
| Command Parser | Custom Named-Argument System |

---

## 💡 Usage (Current Commands)

Commands now support a robust **named-argument system** (`--key value`).

| Command | Action |
|---------|--------|
| `!ping` | Check if bot is responsive |
| `!session-start [min]` | Start tracking (e.g. `!session-start 90`) |
| `!session-end --id 5` | End a specific session or use `all`, `here`, `name` |
| `!session-info --all` | View session details |
| `!session-switch --to "General"` | Move tracking to another channel |
| `!help` | Dynamically generate help documentation for all commands |

---

## 🧪 Testing & Validation

The bot includes a comprehensive **Full System Stress Test** (`tests/fullSystemStressTest.test.js`) that simulates realistic, high-chaos environments:
- **Session Chaos:** Rapidly joining/leaving and muting/unmuting.
- **Concurrency:** Handling 50+ simultaneous users and hundreds of events.
- **Data Integrity:** Validating that no open intervals remain and scores are calculated correctly.

Run the stress test:
```bash
node tests/fullSystemStressTest.test.js
```

---

## 🗺️ Roadmap

- [x] Bot setup with modular command handling
- [x] Voice channel attendance tracking
- [x] Persistent storage (SQLite)
- [x] Role‑based permission checks
- [x] Event-driven modular architecture
- [x] Session auto-end timers & empty channel detection
- [x] Interaction tracking (Messages/Replies/Reactions)
- [x] Participation scoring & engagement classification
- [ ] Session summaries export (CSV/PDF)
- [ ] Web-based Next.js dashboard for instructors
- [ ] Real-time engagement alerts (e.g. "User X has been silent")

---

## 🤝 Contributing

This is a personal graduation project, but suggestions and improvements are welcome! Feel free to open an issue or reach out with ideas.

---

## 🙏 Acknowledgements

- [discord.js](https://discord.js.org/) – powerful Node.js library
- Project designed with ❤️ for real‑world internship experience
