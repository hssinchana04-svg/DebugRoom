<div align="center">

<img src="https://img.shields.io/badge/DebugRoom-Real--Time%20Collaborative%20Debugging-6366f1?style=for-the-badge&logo=lightning&logoColor=white" alt="DebugRoom" />

<h1>⚡ DebugRoom</h1>

<p><strong>Debug together, ship faster.</strong><br/>
A real-time collaborative debugging platform with a live shared terminal, Monaco code editor, session replay, and inline annotations — all in your browser.</p>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-debug--room--frontend.vercel.app-6366f1?style=flat-square&logo=vercel)](https://debug-room-frontend.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=flat-square&logo=railway)](https://backend-production-27df.up.railway.app/health)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## 📸 Overview

DebugRoom lets developers share a **live debugging session** in real time — no screen sharing, no latency, no setup. Create a room, share the link, and your team joins instantly with:

- A **shared terminal** running real shell commands via PTY
- A **collaborative Monaco editor** (same as VS Code) with live cursors
- **Session replay** — replay every keystroke like a video
- **Inline annotations** — comment directly on lines of code
- **No account required** to join a session

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖥️ **Shared Live Terminal** | Real PTY shell streamed to all participants via WebSockets. Everyone sees the same output in real time. |
| 📝 **Collaborative Monaco Editor** | VS Code's editor engine, synced live across all clients with remote cursor indicators. |
| 🎬 **Session Replay** | Every terminal output and code change is recorded and replayable like a video. |
| 💬 **Inline Annotations** | Leave comments on specific lines of code. Synced live to all participants. |
| 🔗 **Instant Room Sharing** | One link to share. Guests join with no signup required. |
| 🔐 **Auth System** | Register/login with username + password, or continue as a guest. JWT-based sessions. |

---

## 🛠️ Tech Stack

### Frontend
| Tech | Purpose |
|---|---|
| [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | UI framework |
| [Vite 5](https://vitejs.dev/) | Build tool & dev server |
| [Tailwind CSS 3](https://tailwindcss.com/) | Utility-first styling |
| [Framer Motion](https://www.framer-motion.com/) | Animations & transitions |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | VS Code-powered code editor |
| [xterm.js](https://xtermjs.org/) | Terminal emulator in the browser |
| [Socket.IO Client](https://socket.io/) | Real-time WebSocket communication |
| [React Router 6](https://reactrouter.com/) | Client-side routing |
| [Lucide React](https://lucide.dev/) | Icon library |

### Backend
| Tech | Purpose |
|---|---|
| [Node.js 20](https://nodejs.org/) + [Express](https://expressjs.com/) | HTTP server |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Socket.IO](https://socket.io/) | Real-time bidirectional events |
| [node-pty](https://github.com/microsoft/node-pty) | Spawn real PTY terminal processes |
| [Prisma ORM](https://www.prisma.io/) | Database access layer |
| [PostgreSQL](https://www.postgresql.org/) | Primary database |
| [JWT](https://jwt.io/) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Authentication & password hashing |
| [Redis](https://redis.io/) | Session caching (in-memory fallback if unavailable) |

### Infrastructure
| Service | Purpose |
|---|---|
| [Railway](https://railway.app) | Backend hosting + PostgreSQL database |
| [Vercel](https://vercel.com) | Frontend static hosting + CDN |
| [GitHub](https://github.com) | Source control & CI/CD trigger |
| [Docker](https://docker.com) | Backend containerization (Debian Bullseye for node-pty) |

---

## 🏗️ Architecture

```
User Browser
    │
    ├─── Frontend (Vercel CDN)
    │     ├── React SPA (Vite build)
    │     ├── Monaco Editor
    │     ├── xterm.js Terminal
    │     └── Socket.IO client ──────────────────────┐
    │                                                 │
    └─── Backend (Railway Linux Container)            │
          ├── Express REST API (/api/*)               │
          ├── Socket.IO Server ◄─────────────────────┘
          │     ├── editor:change  (live code sync)
          │     ├── terminal:data  (PTY output stream)
          │     ├── annotation:*   (live comments)
          │     └── room:*         (presence/participants)
          ├── node-pty (real shell process per room)
          ├── Prisma ORM
          └── PostgreSQL Database (Railway)
```

---

## 📁 Project Structure

```
DebugRoom/
├── 📄 Dockerfile              # Railway deployment (Debian Bullseye)
├── 📄 railway.json            # Railway service config
├── 📄 vercel.json             # Vercel monorepo root config
├── 📄 docker-compose.yml      # Local dev: Postgres + Redis
│
├── 📂 frontend/               # Vite + React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnnotationPanel.tsx   # Inline code comments
│   │   │   ├── CodeEditor.tsx        # Monaco editor with live sync
│   │   │   ├── ParticipantsPanel.tsx # Online users sidebar
│   │   │   ├── ReplayPlayer.tsx      # Session replay modal
│   │   │   └── Terminal.tsx          # xterm.js PTY terminal
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # JWT auth state + localStorage
│   │   ├── lib/
│   │   │   └── config.ts             # API_BASE + SOCKET_URL (env-aware)
│   │   └── pages/
│   │       ├── HomePage.tsx          # Room create/join + landing
│   │       ├── LoginPage.tsx         # Login + register + guest
│   │       └── RoomPage.tsx          # Main debugging workspace
│   ├── vercel.json            # SPA rewrites for React Router
│   └── vite.config.ts         # Dev proxy → localhost:4000
│
└── 📂 backend/                # Express + Socket.IO server
    ├── src/
    │   ├── routes/
    │   │   ├── auth.ts         # POST /api/auth/{login,register,guest}
    │   │   ├── rooms.ts        # POST/GET /api/rooms
    │   │   ├── annotations.ts  # CRUD /api/annotations/:slug
    │   │   └── recordings.ts   # GET /api/recordings/:slug/events
    │   ├── auth.ts             # JWT middleware + token utils
    │   ├── db.ts               # Prisma client singleton
    │   ├── redis.ts            # Redis client with mock fallback
    │   ├── socket.ts           # All Socket.IO event handlers
    │   └── index.ts            # Express app entrypoint
    └── prisma/
        └── schema.prisma       # DB models: User, Room, Annotation, etc.
```

---

## 🗄️ Database Schema

```prisma
User          — id, username, email, passwordHash, isGuest
Room          — id, name, slug (shareable code), hostId
RoomParticipant — roomId, userId, joinedAt, isOnline
CodeSnapshot  — roomId, filePath, content (last known state)
SessionEvent  — roomId, type, data (JSON), sequence (for replay)
Annotation    — roomId, filePath, lineNumber, userId, content
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 20+
- Docker (for Postgres + Redis) or existing instances

### 1. Clone & Install
```bash
git clone https://github.com/hssinchana04-svg/DebugRoom.git
cd DebugRoom
npm install
```

### 2. Start Postgres + Redis
```bash
npm run docker:up
```

### 3. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — DATABASE_URL is already set for Docker Postgres
```

### 4. Run Database Migrations
```bash
cd backend
npx prisma migrate dev
cd ..
```

### 5. Start Dev Servers
```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Prisma Studio | `cd backend && npx prisma studio` |

---

## 🌍 Deployment

This project is deployed on **Railway (backend)** + **Vercel (frontend)**.

### Backend → Railway
1. Create a Railway project → add service from GitHub repo
2. Add **PostgreSQL** plugin
3. Set environment variables (see below)
4. Railway auto-builds via `Dockerfile` and runs migrations on startup

### Frontend → Vercel
1. Import repo → set **Root Directory** to `frontend`
2. Add env var: `VITE_API_URL=https://your-backend.up.railway.app`
3. Deploy

### Environment Variables

**Backend (Railway):**
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=your_strong_secret_here
NODE_ENV=production
PORT=4000
```

**Frontend (Vercel):**
```env
VITE_API_URL=https://your-backend.up.railway.app
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new account |
| `POST` | `/api/auth/login` | Login with credentials |
| `POST` | `/api/auth/guest` | Create anonymous guest session |

### Rooms
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rooms` | Create a new room |
| `GET` | `/api/rooms/:slug` | Get room info by slug |

### Annotations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/annotations/:slug` | Get all annotations for a room |
| `POST` | `/api/annotations/:slug` | Add annotation to a line |
| `DELETE` | `/api/annotations/:slug/:id` | Delete own annotation |

### Recordings
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/recordings/:slug/events` | Get all session events for replay |

### Socket.IO Events
| Event | Direction | Description |
|---|---|---|
| `room:join` | Client → Server | Join a room by slug |
| `editor:change` | Bidirectional | Broadcast code changes |
| `editor:cursor` | Bidirectional | Broadcast cursor position |
| `terminal:input` | Client → Server | Send input to PTY shell |
| `terminal:data` | Server → Client | Stream PTY output |
| `annotation:create` | Bidirectional | Broadcast new annotation |
| `annotation:delete` | Bidirectional | Broadcast annotation removal |

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch: `git checkout -b feat/your-feature`
3. Commit with a descriptive message: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

MIT © 2026 [hssinchana04-svg](https://github.com/hssinchana04-svg)

---

<div align="center">
  <p>Built by developers, for developers 🛠️</p>
  <p>
    <a href="https://debug-room-frontend.vercel.app">Live Demo</a> ·
    <a href="https://github.com/hssinchana04-svg/DebugRoom/issues">Report Bug</a> ·
    <a href="https://github.com/hssinchana04-svg/DebugRoom/issues">Request Feature</a>
  </p>
</div>
