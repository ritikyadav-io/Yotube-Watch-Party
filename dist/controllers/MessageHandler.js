"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
const RoomManager_1 = require("../models/RoomManager");
const Participant_1 = require("../models/Participant");
class MessageHandler {
    constructor(io) {
        this.io = io;
        this.roomManager = RoomManager_1.RoomManager.getInstance();
    }
    registerSocketEvents() {
        this.io.on("connection", (socket) => {
            console.log(`Socket connected: ${socket.id}`);
            // ------------------------------------------------------------------
            // 1. Room Creation & Joining
            // ------------------------------------------------------------------
            socket.on("createRoom", (userObj) => {
                const { room, host } = this.roomManager.createRoom(userObj.username, socket.id);
                socket.join(room.id);
                socket.emit("getRoomID", room.id);
                this.broadcastRoomUsers(room.id);
                socket.emit("sync_state", room.playbackState);
            });
            socket.on("joinRoom", (userObj) => {
                const cleanRoomId = (userObj.roomid && typeof userObj.roomid === 'string') ? userObj.roomid.trim().toUpperCase() : '';
                const result = this.roomManager.joinRoom(cleanRoomId, userObj.username, socket.id);
                if (!result.success || !result.room) {
                    socket.emit("error", { message: result.error || "Cannot join room." });
                    return;
                }
                const room = result.room;
                socket.join(room.id);
                // Notify room
                const joinedName = result.participant ? result.participant.username : userObj.username;
                const message = `${joinedName} joined the party.`;
                socket.to(room.id).emit("message", { username: "System", text: message });
                this.broadcastRoomUsers(room.id);
                // Calculate live playback position based on elapsed time if video is currently playing
                let liveTime = room.playbackState.currentTime;
                if (room.playbackState.isPlaying) {
                    const elapsed = (Date.now() - room.playbackState.updatedAt) / 1000;
                    liveTime += elapsed;
                }
                const syncPayload = Object.assign(Object.assign({}, room.playbackState), { currentTime: liveTime });
                // Send latest live sync state to joining participant
                socket.emit("sync_state", syncPayload);
                socket.emit("playlistUpdated", room.playlist);
            });
            // ------------------------------------------------------------------
            // 2. Playback Synchronization (Backend Permission Enforced)
            // ------------------------------------------------------------------
            socket.on("videoPaused", () => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const perm = room.validatePermission(socket.id, "pause");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }
                room.playbackState.isPlaying = false;
                room.playbackState.updatedAt = Date.now();
                socket.to(room.id).emit("videoPaused");
            });
            socket.on("videoPlaying", (currentTime) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const perm = room.validatePermission(socket.id, "play");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }
                room.playbackState.isPlaying = true;
                room.playbackState.currentTime = currentTime;
                room.playbackState.updatedAt = Date.now();
                socket.to(room.id).emit("videoPlaying", currentTime);
            });
            socket.on("seek", (currentTime) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const perm = room.validatePermission(socket.id, "seek");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }
                room.playbackState.currentTime = currentTime;
                socket.to(room.id).emit("seek", currentTime);
            });
            socket.on("playNextVideo", () => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const perm = room.validatePermission(socket.id, "change_video");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }
                this.io.to(room.id).emit("playNextVideo");
            });
            socket.on("playPreviousVideo", () => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const perm = room.validatePermission(socket.id, "change_video");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }
                this.io.to(room.id).emit("playPreviousVideo");
            });
            socket.on("playVideoDirectly", (videoObj) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room || !videoObj || !videoObj.video_id)
                    return;
                const perm = room.validatePermission(socket.id, "change_video");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason || "Only the Room Host can change the video." });
                    return;
                }
                room.playbackState.videoId = videoObj.video_id;
                room.playbackState.videoObj = videoObj;
                room.playbackState.currentTime = 0;
                room.playbackState.isPlaying = true;
                room.playbackState.updatedAt = Date.now();
                // Broadcast new video and live sync state to all room members
                this.io.to(room.id).emit("playVideoDirectly", videoObj);
                this.io.to(room.id).emit("sync_state", room.playbackState);
            });
            socket.on("playlistUpdated", (updatedPlaylist) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                room.playlist = updatedPlaylist;
                this.io.to(room.id).emit("playlistUpdated", updatedPlaylist);
            });
            // ------------------------------------------------------------------
            // 3. Host Capabilities & RBAC Management
            // ------------------------------------------------------------------
            socket.on("assign_role", (data) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const res = room.assignRole(socket.id, data.targetSocketId, data.role);
                if (!res.success) {
                    socket.emit("permission_error", { message: res.message });
                    return;
                }
                this.broadcastRoomUsers(room.id);
                this.io.to(room.id).emit("role_assigned", {
                    targetSocketId: data.targetSocketId,
                    newRole: data.role
                });
            });
            socket.on("transfer_host", (data) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const res = room.transferHost(socket.id, data.targetSocketId);
                if (!res.success) {
                    socket.emit("permission_error", { message: res.message });
                    return;
                }
                this.broadcastRoomUsers(room.id);
                this.io.to(room.id).emit("host_transferred", {
                    newHostSocketId: data.targetSocketId
                });
            });
            socket.on("remove_participant", (data) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const res = room.kickParticipant(socket.id, data.targetSocketId);
                if (!res.success || !res.kickedUser) {
                    socket.emit("permission_error", { message: res.message });
                    return;
                }
                // Force disconnect target socket
                const targetSocket = this.io.sockets.sockets.get(data.targetSocketId);
                if (targetSocket) {
                    targetSocket.emit("kicked_from_room", { message: "You were removed from the watch party by the Host." });
                    targetSocket.leave(room.id);
                }
                this.broadcastRoomUsers(room.id);
                this.io.to(room.id).emit("participant_removed", {
                    username: res.kickedUser.username
                });
            });
            // ------------------------------------------------------------------
            // 4. Participant Request Approval System
            // ------------------------------------------------------------------
            socket.on("request_action", (data) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const req = room.submitApprovalRequest(socket.id, data.type, data.payload);
                if (!req)
                    return;
                // Send request notification to Host and Moderators
                let sentToHost = false;
                room.participants.forEach(p => {
                    if (p.role === Participant_1.Role.HOST || p.role === Participant_1.Role.MODERATOR) {
                        this.io.to(p.id).emit("approval_request_received", req);
                        sentToHost = true;
                    }
                });
                // Acknowledge to requesting participant
                socket.emit("request_sent_acknowledgement", {
                    message: "Request sent to Host! Waiting for approval...",
                    req
                });
            });
            socket.on("handle_request", (data) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room)
                    return;
                const res = room.handleApprovalRequest(socket.id, data.requestId, data.approve);
                if (!res.success || !res.req) {
                    socket.emit("permission_error", { message: res.message });
                    return;
                }
                const req = res.req;
                if (data.approve) {
                    if (req.type === 'change_video' && req.payload) {
                        room.playbackState.videoId = req.payload.video_id;
                        room.playbackState.videoObj = req.payload;
                        room.playbackState.currentTime = 0;
                        room.playbackState.isPlaying = true;
                        room.playbackState.updatedAt = Date.now();
                        this.io.to(room.id).emit("playVideoDirectly", req.payload);
                    }
                    else if (req.type === 'play_request' && req.payload) {
                        if (req.payload.action === 'next') {
                            this.io.to(room.id).emit("playNextVideo");
                        }
                        else if (req.payload.action === 'prev') {
                            this.io.to(room.id).emit("playPreviousVideo");
                        }
                        else if (req.payload.video_id) {
                            room.playbackState.videoId = req.payload.video_id;
                            room.playbackState.videoObj = req.payload;
                            room.playbackState.currentTime = 0;
                            room.playbackState.isPlaying = true;
                            room.playbackState.updatedAt = Date.now();
                            this.io.to(room.id).emit("playVideoDirectly", req.payload);
                        }
                    }
                    this.io.to(room.id).emit("message", {
                        username: "System",
                        text: `Host approved ${req.username}'s request!`
                    });
                    this.io.to(req.participantSocketId).emit("request_result", {
                        approved: true,
                        message: "Host approved your request!"
                    });
                }
                else {
                    this.io.to(room.id).emit("message", {
                        username: "System",
                        text: `Host declined ${req.username}'s request.`
                    });
                    this.io.to(req.participantSocketId).emit("request_result", {
                        approved: false,
                        message: "Host declined your request."
                    });
                }
            });
            // ------------------------------------------------------------------
            // 5. Chat & Connection Disconnect
            // ------------------------------------------------------------------
            socket.on("sendMessage", (message, callback) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (room) {
                    const participant = room.getParticipant(socket.id);
                    const name = participant ? participant.username : 'Guest';
                    const isHost = participant ? (participant.role === Participant_1.Role.HOST || participant.role === 'ADMIN') : false;
                    this.io.to(room.id).emit("message", {
                        username: name,
                        text: message,
                        senderId: socket.id,
                        isHost: isHost,
                        timestamp: Date.now()
                    });
                }
                if (typeof callback === 'function')
                    callback();
            });
            socket.on("disconnect", () => {
                const { room, participant } = this.roomManager.leaveRoom(socket.id);
                if (room && participant) {
                    const leftUsername = participant.username;
                    const targetRoomId = room.id;
                    // 1.5s grace period before announcing leave message to avoid false leave notifications on refresh/reconnect
                    setTimeout(() => {
                        const targetRoom = this.roomManager.getRoom(targetRoomId);
                        const isReconnected = targetRoom && targetRoom.getParticipantsList().some(p => p.username.toLowerCase() === leftUsername.toLowerCase());
                        if (!isReconnected) {
                            this.io.to(targetRoomId).emit("message", {
                                username: "System",
                                text: `${leftUsername} left the room.`
                            });
                        }
                        this.broadcastRoomUsers(targetRoomId);
                    }, 1500);
                }
            });
        });
    }
    broadcastRoomUsers(roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (room) {
            this.io.to(roomId).emit("roomUsersList", {
                usersList: room.getParticipantsList(),
                hostSocketId: room.hostSocketId
            });
        }
    }
}
exports.MessageHandler = MessageHandler;
