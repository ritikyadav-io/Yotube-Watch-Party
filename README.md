# 🎬 YouTube Watch Party System

> **Intern Assignment Submission** – A real-time, synchronized YouTube Watch Party platform built with **Node.js, Express, TypeScript, Socket.IO, and HTML5/CSS3**. Supports Role-Based Access Control (RBAC), Object-Oriented WebSocket Server architecture, in-app YouTube video search & discovery, and participant request approval workflows.

---

## 🌐 Live Deployment & Demo URL
- **Public Live Application URL:** [https://youtube-party-watch.onrender.com](https://youtube-party-watch.onrender.com) *(Replace with your live Render/Vercel link)*
- **GitHub Repository:** [https://github.com/ritikyadav-io/Yotube-Watch-Party](https://github.com/ritikyadav-io/Yotube-Watch-Party)

---

## 🚀 Key Features

1. **Real-time Video Synchronization:** All participants in a room see synchronized video state (play, pause, seek, current video, and playlist queue).
2. **Room-Based Access Model:** Create new rooms or join existing rooms via unique Room ID or invite link.
3. **In-App Embedded Playback:** YouTube videos play strictly inside the embedded YouTube IFrame player without redirecting users to external sites.
4. **Role-Based Access Control (RBAC):**
   - 👑 **Host (Creator):** Full administrative control (play/pause, seek, change video, assign roles, kick participants, transfer host role).
   - 🛡️ **Moderator:** Playback control (play/pause, seek, change video).
   - 👤 **Participant:** Watch-only mode. Restricted from direct playback control; can submit approval requests to Host/Moderators.
5. **Backend Role Validation:** Permission checks are strictly enforced on the server before processing or broadcasting playback events.
6. **Participant Request Approval Workflow:** When a Participant requests a video change or play action, Host and Moderators receive a real-time prompt to Approve or Reject.
7. **Below-Player YouTube Discovery Feed:** Search YouTube videos or browse curated category feeds (*Trending, Music, Gaming, Tech, Entertainment*) directly below the player. Includes a YouTube API Key Manager modal.
8. **Live Chat & Member List:** Real-time messaging with Host badges, online user lists, and host management dropdowns.

---

## 🏗️ Architecture & WebSockets Flow

### WebSockets Integration Flow

```
[Client A (Host)]      --->  (Socket.IO Event: videoPlaying / seek)
                              |
                              v
                      [MessageHandler Controller]
                              |
                     (Permission Validation via Room.ts)
                              |
                              +--> Allowed? Yes ---> Broadcast to Room ---> [Client B (Participant)]
                              |
                              +--> Allowed? No  ---> Emit permission_error ---> [Client C (Restricted)]
```

- **Transport:** Socket.IO over WebSocket (with HTTP long-polling fallback).
- **Session Lifecycle:** User joins a room -> `RoomManager` registers socket -> Server assigns role (Host if creator, else Participant) -> Server broadcasts updated `roomUsersList` and latest `sync_state`.

---

## 🧱 Object-Oriented Server Design (OOP)

The WebSocket server is structured using clean OOP design patterns:

```
src/
├── models/
│   ├── Participant.ts    # Encapsulates user identity, socket ID, role enum, and permission checks
│   ├── Room.ts           # Encapsulates room state, participant map, queue, kick, role assignment logic
│   └── RoomManager.ts    # Singleton registry managing room creation, lookup, and lifecycle
├── controllers/
│   └── MessageHandler.ts # Handles Socket.IO event registrations, RBAC dispatching, and broadcasts
└── index.ts              # Entry point initializing Express, HTTP server, and MessageHandler
```

### OOP Class Summary:
- **`Participant` Class:** Manages socket ID, username, room assignment, role (`HOST` | `MODERATOR` | `PARTICIPANT`), and `hasPermission(action)` method.
- **`Room` Class:** Stores playback state (`videoId`, `currentTime`, `isPlaying`), participant collections, queue, and permission validation logic (`validatePermission`, `assignRole`, `kickParticipant`, `transferHost`).
- **`RoomManager` Class:** Singleton managing active `Room` instances and socket-to-room mappings.
- **`MessageHandler` Class:** Encapsulates all WebSocket event listeners and connects incoming events with `RoomManager`.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

| Feature / Action | 👑 Host | 🛡️ Moderator | 👤 Participant |
| :--- | :---: | :---: | :---: |
| Watch Video Stream | ✅ | ✅ | ✅ |
| Live Chat & Messaging | ✅ | ✅ | ✅ |
| Play / Pause Video | ✅ | ✅ | ❌ *(Request Approval)* |
| Seek Position | ✅ | ✅ | ❌ *(Request Approval)* |
| Change / Add Video | ✅ | ✅ | ❌ *(Request Approval)* |
| Assign / Revoke Roles | ✅ | ❌ | ❌ |
| Transfer Host Role | ✅ | ❌ | ❌ |
| Kick Participant | ✅ | ❌ | ❌ |

---

## 📡 WebSocket Event Catalog

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `createRoom` | Client ➔ Server | `{ username }` | Host creates a new room. Server returns `getRoomID`. |
| `joinRoom` | Client ➔ Server | `{ username, roomid }` | User joins room. Assigned Host if first, else Participant. |
| `sync_state` | Server ➔ Client | `{ videoId, currentTime, isPlaying }` | Broadcasts current video state to newly joined user. |
| `videoPlaying` | Client ➔ Server ➔ Client | `currentTime` | User pressed play/started playing. Server validates RBAC and broadcasts. |
| `videoPaused` | Client ➔ Server ➔ Client | `{}` | User paused video. Server validates RBAC and broadcasts. |
| `seek` | Client ➔ Server ➔ Client | `currentTime` | User scrubbed video timeline. Server validates RBAC and broadcasts. |
| `playVideoDirectly` | Client ➔ Server ➔ Client | `{ video_id, title, channel }` | Changes current playing video. Server validates RBAC and broadcasts. |
| `assign_role` | Client ➔ Server | `{ targetSocketId, role }` | Host assigns `MODERATOR` or `PARTICIPANT` role. |
| `transfer_host` | Client ➔ Server | `{ targetSocketId }` | Host transfers Host privileges to another participant. |
| `remove_participant` | Client ➔ Server | `{ targetSocketId }` | Host kicks participant from room. |
| `kicked_from_room` | Server ➔ Client | `{ message }` | Target socket receives kick notification and disconnects. |
| `request_action` | Client ➔ Server | `{ type, payload }` | Participant requests Host/Mod to approve video change or playback. |
| `handle_request` | Client ➔ Server | `{ requestId, approve }` | Host/Mod approves or rejects participant request. |
| `sendMessage` | Client ➔ Server ➔ Client | `{ text }` | Broadcasts live chat message. |

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

1. **Socket.IO Redis Adapter:** Attach `@socket.io/redis-adapter` to publish and subscribe events across multiple Node.js instances. A broadcast in Room X on Node 1 is immediately relayed via Redis Pub/Sub to Node 2 where other participants are connected.
2. **Stateless Room State & Redis Store:** Store room metadata and active participant mappings in Redis (or PostgreSQL) instead of in-memory maps.
3. **Load Balancing with Sticky Sessions:** Use Nginx or AWS Application Load Balancer with HTTP cookie sticky sessions to maintain WebSocket handshake consistency.
4. **Connection Pooling:** Optimize WebSocket ping/pong intervals and set max connection limits per node.

---

## 💻 Local Setup & Execution Guide

### Prerequisites
- Node.js (v16.x or higher)
- npm (v8.x or higher)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ritikyadav-io/Yotube-Watch-Party.git
   cd Yotube-Watch-Party
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## ☁️ Deployment Instructions (Render / Vercel / Railway)

### Deploying to Render (Recommended for WebSocket Support)
1. Push your repository to GitHub.
2. Log into [Render.com](https://render.com) and click **New + > Web Service**.
3. Connect your GitHub repository (`Youtube-Party`).
4. Set configuration:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Click **Create Web Service**. Your live URL will be generated (e.g., `https://youtube-party.onrender.com`).

---

## 📜 License
This project is licensed under the ISC License.
