# 🎬 YouTube Watch Party System

> **Real-Time Synchronized Video Streaming & Social Watch Party Platform**  
> Built with **Node.js, Express, TypeScript, Socket.IO, HTML5, and CSS3**. Features real-time video synchronization, server-enforced Role-Based Access Control (RBAC), Object-Oriented WebSocket Server architecture, dynamic YouTube API video search & discovery, interactive participant song approval workflows, and host reconnection protection.

---

## 🌐 Live Deployments & Repository
- ⚡ **Render Production App:** [https://yotube-watch-party.onrender.com/](https://yotube-watch-party.onrender.com/) *(Full Node.js + WebSocket Server)*
- 🌐 **Vercel Production App:** [https://yotube-watch-party-six.vercel.app/](https://yotube-watch-party-six.vercel.app/) *(Global CDN Frontend)*
- 📦 **GitHub Repository:** [https://github.com/ritikyadav-io/Yotube-Watch-Party](https://github.com/ritikyadav-io/Yotube-Watch-Party)

---

## 🚀 Key Features & Highlights

1. **Sub-Second Video Synchronization:** All participants in a room stay in lockstep synchronization (play, pause, seek, video switching, and playlist queue). Joining participants automatically seek to the host's exact live playback timestamp (e.g. 5:00) with zero manual refresh.
2. **Dynamic YouTube API Video Search:** In-app search bar and category pills query live YouTube search results via `/api/youtube/search`. The **"Watch More Songs"** feed dynamically rotates through diverse top search queries without repeating video cards.
3. **Server-Enforced Role-Based Access Control (RBAC):**
   - 👑 **Host (Creator):** Full administrative & playback authority (play/pause, seek, change video, next/prev, assign roles, kick users, transfer host).
   - 🛡️ **Moderator:** Full playback control (play/pause, seek, change video).
   - 👤 **Participant:** Watch-only mode. Direct video changes are restricted; participants can submit song requests to the Host.
4. **Interactive Request Approval Workflow:** When a Participant clicks a song or action, an interactive modal (*"🎵 Song Approval Request"*) pops up on the Host's screen with **Approve & Play** and **Decline** options.
5. **Host Disconnection Protection:** Implements a 15-second grace period (`hostDisconnectTimer`) on the server. If the Host's mobile screen dims or network flickers, the server preserves their `Role.HOST` status upon reconnection instead of auto-demoting them.
6. **Strict Capacity & Privacy Controls:** Enforces a maximum limit of 5 participants per room. Room Code and Invite Link controls are visible strictly to the Room Host.
7. **Live Chat & Online Room Roster:** Integrated real-time messaging with Host/Moderator badges, unread message badges, system join/leave toasts, and dropdown management controls.

---

## 🧱 Object-Oriented Server Architecture (OOP)

The WebSocket server is built using clean Object-Oriented Programming (OOP) design patterns in TypeScript:

```
src/
├── models/
│   ├── Participant.ts    # User entity (socketId, username, Role enum, permission checks)
│   ├── Room.ts           # Room aggregate (playbackState, participants Map, queue, approval requests, grace timer)
│   └── RoomManager.ts    # Singleton registry managing active Room lifecycles & socket mappings
├── controllers/
│   └── MessageHandler.ts # OOP Socket.IO controller handling events, RBAC dispatching, and broadcasts
├── utils/
│   └── generateRoomID.ts # Helper generating clean 4-digit room IDs
└── index.ts              # Entry point initializing Express REST API, HTTP server, and MessageHandler
```

### OOP Class Summary:
- **`Participant` Class:** Manages user identity, socket connection ID, room association, role (`HOST` | `MODERATOR` | `PARTICIPANT`), and permission validation via `hasPermission(action)`.
- **`Room` Class:** Manages live `playbackState` (`videoId`, `currentTime`, `isPlaying`), participant maps, playlist queue, host reconnection timers (`hostDisconnectTimer`), and permission enforcement (`validatePermission`, `submitApprovalRequest`, `handleApprovalRequest`, `kickParticipant`, `transferHost`).
- **`RoomManager` Class:** Singleton registry managing room lookup, case-normalized room joins, capacity checks (max 5), and 60-second empty room grace period cleanup.
- **`MessageHandler` Class:** Encapsulates all Socket.IO WebSocket event handlers and orchestrates real-time events between clients and `RoomManager`.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

| Feature / Action | 👑 Host | 🛡️ Moderator | 👤 Participant |
| :--- | :---: | :---: | :---: |
| Watch Synchronized Video | ✅ | ✅ | ✅ |
| Live Chat & Messaging | ✅ | ✅ | ✅ |
| Play / Pause Playback | ✅ | ✅ | ❌ *(Requires Host Approval)* |
| Seek Video Position | ✅ | ✅ | ❌ *(Requires Host Approval)* |
| Direct Video Change | ✅ | ✅ | ❌ *(Requires Host Approval)* |
| Approve / Decline Requests | ✅ | ✅ | ❌ |
| Assign / Revoke Roles | ✅ | ❌ | ❌ |
| Transfer Host Role | ✅ | ❌ | ❌ |
| Kick Participant | ✅ | ❌ | ❌ |

---

## 📡 WebSocket Event Catalog

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `createRoom` | Client ➔ Server | `{ username }` | Creates a new room. Server returns `getRoomID`. |
| `joinRoom` | Client ➔ Server | `{ username, roomid }` | User joins room. Validates capacity and assigns role. |
| `sync_state` | Server ➔ Client | `{ videoId, currentTime, isPlaying }` | Sends live playback state and calculated live time to joiners. |
| `videoPlaying` | Client ➔ Server ➔ Client | `currentTime` | Updates live playback position. Server validates RBAC and broadcasts. |
| `videoPaused` | Client ➔ Server ➔ Client | `{}` | Pauses video for room. Server validates RBAC and broadcasts. |
| `seek` | Client ➔ Server ➔ Client | `currentTime` | Seeks video position across all room participants. |
| `playVideoDirectly` | Client ➔ Server ➔ Client | `{ video_id, title, channel }` | Plays selected video directly. Server validates RBAC and broadcasts. |
| `playNextVideo` | Client ➔ Server ➔ Client | `{}` | Plays next video from queue/catalog for everyone. |
| `playPreviousVideo` | Client ➔ Server ➔ Client | `{}` | Plays previous video from history for everyone. |
| `request_action` | Client ➔ Server | `{ type, payload }` | Participant requests Host approval to play a video or change playback. |
| `approval_request_received` | Server ➔ Client (Host) | `{ id, username, type, payload }` | Delivers song approval request modal to Host. |
| `handle_request` | Client (Host) ➔ Server | `{ requestId, approve }` | Host approves or declines participant request. |
| `request_result` | Server ➔ Client | `{ approved, message }` | Notifies requesting participant of Host decision. |
| `assign_role` | Client ➔ Server | `{ targetSocketId, role }` | Host promotes user to `MODERATOR` or demotes to `PARTICIPANT`. |
| `transfer_host` | Client ➔ Server | `{ targetSocketId }` | Host transfers Host privileges to another member. |
| `remove_participant` | Client ➔ Server | `{ targetSocketId }` | Host kicks participant from room. |

---

## ⚡ Scalability Architecture (1,000+ Concurrent Users)

To scale this system horizontally across multiple server nodes to handle **1,000+ users, 100+ rooms, and 50+ users per room**:

```
                              [ Load Balancer (Nginx / AWS ALB) ]
                                 (Sticky Sessions enabled)
                                     /             \
                                    v               v
                         [Server Instance 1]    [Server Instance 2]
                                    \               /
                                     v             v
                                 [Redis Pub/Sub Cluster]
                               (Socket.IO Redis Adapter)
```

1. **Socket.IO Redis Adapter:** Attach `@socket.io/redis-adapter` to publish and subscribe events across multiple Node.js server instances. A broadcast in Room X on Node 1 is immediately relayed via Redis Pub/Sub to Node 2 where other participants are connected.
2. **Stateless Room State & Redis Store:** Store room metadata, playback state, and socket mappings in Redis (or PostgreSQL) instead of local in-memory Maps.
3. **Load Balancing with Sticky Sessions:** Configure Nginx or AWS Application Load Balancer with HTTP cookie sticky sessions to maintain WebSocket handshake consistency.
4. **Connection Pooling & Heartbeats:** Tune WebSocket ping/pong intervals and set max connection limits per node.

---

## 💻 Local Setup & Execution Guide

### Prerequisites
- **Node.js** (v16.x or higher)
- **npm** (v8.x or higher)

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

### Deploying to Render (Recommended for Full WebSocket Server)
1. Push your latest code to GitHub.
2. Log into [Render.com](https://render.com) and click **New + > Web Service**.
3. Select your GitHub repository (`Yotube-Watch-Party`).
4. Configure service settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Click **Create Web Service**. Your live URL will be generated (e.g., `https://yotube-watch-party.onrender.com`).

---

## 📜 License
This project is licensed under the **ISC License**.
