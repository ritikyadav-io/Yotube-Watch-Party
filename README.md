# 🎬 YouTube Watch Party System

> **Real-time synchronized video streaming and social watch-party platform.**  
> Built with **Node.js, Express, TypeScript, Socket.IO, HTML5, and CSS3** — featuring real-time video sync, server-enforced Role-Based Access Control (RBAC), an object-oriented WebSocket server architecture, dynamic YouTube API video search & discovery, interactive song-approval workflows, and host-reconnection protection.

[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-010101?logo=socket.io&logoColor=white)](https://socket.io/)

---

## 🌐 Live Deployments & Repository

| Deployment | Link | Notes |
| :--- | :--- | :--- |
| ⚡ Render (Production) | [yotube-watch-party.onrender.com](https://yotube-watch-party.onrender.com/) | Full Node.js + WebSocket server |
| 🌐 Vercel (Production) | [yotube-watch-party-six.vercel.app](https://yotube-watch-party-six.vercel.app/) | Global CDN frontend |
| 📦 GitHub Repository | [github.com/ritikyadav-io/Yotube-Watch-Party](https://github.com/ritikyadav-io/Yotube-Watch-Party) | Source code |

---

## 📑 Table of Contents

- [Key Features](#-key-features--highlights)
- [How WebSockets Power the System](#-how-websockets-integrate-with-the-system-flow)
- [Server Architecture](#-object-oriented-server-architecture-oop)
- [RBAC Matrix](#-role-based-access-control-rbac-matrix)
- [WebSocket Event Catalog](#-websocket-event-catalog)
- [Scalability Architecture](#-scalability-architecture-1000-concurrent-users)
- [Local Setup](#-local-setup--execution-guide)
- [Deployment Guide](#-deployment-guide-render--vercel)

---

## 🚀 Key Features & Highlights

1. **Sub-Second Video Synchronization** — All participants in a room stay in lockstep (play, pause, seek, video switching, playlist queue). Joining participants automatically seek to the host's exact live playback timestamp (e.g., 5:00) with zero manual refresh.
2. **Dynamic YouTube API Video Search** — An in-app search bar and category pills query live YouTube results via `/api/youtube/search`. The **"Watch More Songs"** feed dynamically rotates through diverse top search queries without repeating video cards.
3. **Server-Enforced Role-Based Access Control (RBAC)**:
   - 👑 **Host (Creator):** Full administrative & playback authority — play/pause, seek, change video, next/previous, assign roles, kick users, transfer host.
   - 🛡️ **Moderator:** Full playback control — play/pause, seek, change video.
   - 👤 **Participant:** Watch-only mode. Direct video changes are restricted; participants can submit song requests to the host.
4. **Interactive Request Approval Workflow** — When a participant clicks a song or action, an interactive modal ("🎵 Song Approval Request") pops up on the host's screen with **Approve & Play** and **Decline** options.
5. **Host Disconnection Protection** — A 15-second grace period (`hostDisconnectTimer`) on the server. If the host's mobile screen dims or their network flickers, the server preserves their `Role.HOST` status on reconnection instead of auto-demoting them.
6. **Strict Capacity & Privacy Controls** — Enforces a maximum of 5 participants per room. Room code and invite link controls are visible only to the room host.
7. **Live Chat & Online Room Roster** — Real-time messaging with host/moderator badges, unread-message badges, system join/leave toasts, and dropdown management controls.

---

## ⚡ How WebSockets Integrate with the System Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        WEBSOCKET ARCHITECTURE & EVENT FLOW SYSTEM                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. PERSISTENT FULL-DUPLEX CONNECTION                                                  │
│    • Clients establish Socket.IO connection over WebSockets (long-polling fallback).  │
│    • Joining a room calls socket.join(room.id) to subscribe to room-specific channel. │
│                                                                                        │
│ 2. CALCULATED LIVE TIMESTAMP SYNC (sync_state)                                         │
│    • Server calculates: liveTime = room.currentTime + ((Date.now() - updatedAt)/1000) │
│    • Emits sync_state directly to joiners -> player seeks to exact live time (e.g. 5:00)│
│                                                                                        │
│ 3. SERVER-ENFORCED RBAC BROADCASTING                                                  │
│    • Playback actions trigger WebSocket events (videoPlaying, videoPaused, seek, etc). │
│    • MessageHandler validates Room.validatePermission(socket.id, action) on server.    │
│    • If approved -> updates room.playbackState and broadcasts to io.to(room.id).      │
│                                                                                        │
│ 4. REQUEST APPROVAL SYSTEM & RECONNECT GRACE                                           │
│    • Participants emitting restricted actions trigger approval_request_received for Host│
│    • Host approvals trigger handle_request -> broadcasts playVideoDirectly.            │
│    • Host network flickers trigger 15s hostDisconnectTimer to preserve Role.HOST.      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

```mermaid
sequenceDiagram
    autonumber
    actor Host as 👑 Host (Client)
    participant Server as ⚙️ Node.js WebSocket Server
    participant Room as 🧱 Room / RoomManager
    actor Participant as 👤 Participant (Client)

    Host->>Server: emit("createRoom", { username })
    Server->>Room: RoomManager.createRoom()
    Room-->>Server: Room & Host Instance
    Server-->>Host: emit("getRoomID", roomId)

    Participant->>Server: emit("joinRoom", { username, roomId })
    Server->>Room: RoomManager.joinRoom()
    Room-->>Server: Success + Role.PARTICIPANT
    Server-->>Participant: emit("sync_state", { videoId, currentTime, isPlaying })
    Server-->>Host: broadcast("roomUsersList", users)

    Host->>Server: emit("playVideoDirectly", videoObj)
    Server->>Room: validatePermission(socket.id, "change_video")
    Room-->>Server: Allowed = true
    Server-->>Host: emit("playVideoDirectly", videoObj)
    Server-->>Participant: emit("playVideoDirectly", videoObj)
```

---

## 🧱 Object-Oriented Server Architecture (OOP)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        OBJECT-ORIENTED BACKEND ARCHITECTURE                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ src/                                                                                   │
│ ├── models/                                                                            │
│ │   ├── Participant.ts   # User entity (socketId, username, Role enum, permission gate) │
│ │   ├── Room.ts          # Aggregate root (playbackState, participants Map, queue, RBAC)│
│ │   └── RoomManager.ts   # Singleton registry (room creation, lookup, capacity & cleanup) │
│ ├── controllers/                                                                       │
│ │   └── MessageHandler.ts# OOP Socket controller handling events & RBAC broadcasts    │
│ ├── utils/                                                                             │
│ │   └── generateRoomID.ts# Unique 4-character Room ID generator                         │
│ └── index.ts             # Application bootstrapper (Express REST, static & Socket.IO) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Class Summary

- **`Participant`** — Manages user identity, socket connection ID, room association, role (`HOST` | `MODERATOR` | `PARTICIPANT`), and permission validation via `hasPermission(action)`.
- **`Room`** — Manages live `playbackState` (`videoId`, `currentTime`, `isPlaying`), participant maps, playlist queue, host reconnection timers (`hostDisconnectTimer`), and permission enforcement (`validatePermission`, `submitApprovalRequest`, `handleApprovalRequest`, `kickParticipant`, `transferHost`).
- **`RoomManager`** — Singleton registry managing room lookup, case-normalized room joins, capacity checks (max 5), and a 60-second empty-room grace-period cleanup.
- **`MessageHandler`** — Encapsulates all Socket.IO event handlers and orchestrates real-time events between clients and `RoomManager`.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Feature / Action | 👑 Host | 🛡️ Moderator | 👤 Participant |
| :--- | :---: | :---: | :---: |
| Watch synchronized video | ✅ | ✅ | ✅ |
| Live chat & messaging | ✅ | ✅ | ✅ |
| Play / pause playback | ✅ | ✅ | ❌ *(requires host approval)* |
| Seek video position | ✅ | ✅ | ❌ *(requires host approval)* |
| Direct video change | ✅ | ✅ | ❌ *(requires host approval)* |
| Approve / decline requests | ✅ | ✅ | ❌ |
| Assign / revoke roles | ✅ | ❌ | ❌ |
| Transfer host role | ✅ | ❌ | ❌ |
| Kick participant | ✅ | ❌ | ❌ |

---

## 📡 WebSocket Event Catalog

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           SOCKET.IO WEBSOCKET EVENT CATALOG                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `createRoom` | Client → Server | `{ username }` | Creates a new room. Server returns the room ID. |
| `joinRoom` | Client → Server | `{ username, roomid }` | User joins a room. Validates capacity and assigns a role. |
| `sync_state` | Server → Client | `{ videoId, currentTime, isPlaying }` | Sends live playback state and calculated live time to joiners. |
| `videoPlaying` | Client → Server → Client | `currentTime` | Updates live playback position. Server validates RBAC and broadcasts. |
| `videoPaused` | Client → Server → Client | `{}` | Pauses video for the room. Server validates RBAC and broadcasts. |
| `seek` | Client → Server → Client | `currentTime` | Seeks video position across all room participants. |
| `playVideoDirectly` | Client → Server → Client | `{ video_id, title, channel }` | Plays a selected video directly. Server validates RBAC and broadcasts. |
| `playNextVideo` | Client → Server → Client | `{}` | Plays the next video from the queue/catalog for everyone. |
| `playPreviousVideo` | Client → Server → Client | `{}` | Plays the previous video from history for everyone. |
| `request_action` | Client → Server | `{ type, payload }` | Participant requests host approval to play a video or change playback. |
| `approval_request_received` | Server → Client (Host) | `{ id, username, type, payload }` | Delivers a song-approval request modal to the host. |
| `handle_request` | Client (Host) → Server | `{ requestId, approve }` | Host approves or declines a participant request. |
| `request_result` | Server → Client | `{ approved, message }` | Notifies the requesting participant of the host's decision. |
| `assign_role` | Client → Server | `{ targetSocketId, role }` | Host promotes a user to `MODERATOR` or demotes to `PARTICIPANT`. |
| `transfer_host` | Client → Server | `{ targetSocketId }` | Host transfers host privileges to another member. |
| `remove_participant` | Client → Server | `{ targetSocketId }` | Host kicks a participant from the room. |

---

## ⚡ Scalability Architecture (1,000+ Concurrent Users)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HORIZONTAL SCALABILITY ARCHITECTURE                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                          [ Load Balancer (Nginx / AWS ALB) ]                           │
│                              (Sticky sessions enabled)                                 │
│                                  /               \                                     │
│                                 v                 v                                    │
│                      [ Server Instance 1 ]   [ Server Instance 2 ]                     │
│                                 \                 /                                    │
│                                  v               v                                     │
│                            [ Redis Pub/Sub Cluster ]                                   │
│                            (Socket.IO Redis Adapter)                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Socket.IO Redis Adapter** — Attach `@socket.io/redis-adapter` to publish and subscribe to events across multiple Node.js server instances. A broadcast in Room X on Node 1 is immediately relayed via Redis Pub/Sub to Node 2, where other participants are connected.
2. **Stateless Room State & Redis Store** — Store room metadata, playback state, and socket mappings in Redis (or PostgreSQL) instead of local in-memory Maps.
3. **Load Balancing with Sticky Sessions** — Configure Nginx or an AWS Application Load Balancer with HTTP cookie sticky sessions to keep WebSocket handshakes consistent.
4. **Connection Pooling & Heartbeats** — Tune WebSocket ping/pong intervals and set max connection limits per node.

---

## 💻 Local Setup & Execution Guide

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL INSTALLATION & SETUP GUIDE                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Prerequisites

- **Node.js** v16.x or higher
- **npm** v8.x or higher

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ritikyadav-io/Yotube-Watch-Party.git
   cd Yotube-Watch-Party
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

---

## ☁️ Deployment Guide (Render / Vercel)

### Deploying to Render (recommended for the full WebSocket server)

1. Push your latest code to GitHub.
2. Log into [Render.com](https://render.com) and click **New +** → **Web Service**.
3. Select your GitHub repository (`Yotube-Watch-Party`).
4. Configure service settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Click **Create Web Service**. Your live URL will be generated (e.g., `https://yotube-watch-party.onrender.com`).

---
