import { Server, Socket } from 'socket.io';
import { RoomManager } from '../models/RoomManager';
import { Role } from '../models/Participant';

export class MessageHandler {
    private io: Server;
    private roomManager: RoomManager;

    constructor(io: Server) {
        this.io = io;
        this.roomManager = RoomManager.getInstance();
    }

    public registerSocketEvents(): void {
        this.io.on("connection", (socket: Socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // ------------------------------------------------------------------
            // 1. Room Creation & Joining
            // ------------------------------------------------------------------
            socket.on("createRoom", (userObj: { username: string }) => {
                const { room, host } = this.roomManager.createRoom(userObj.username, socket.id);
                socket.join(room.id);
                socket.emit("getRoomID", room.id);
                this.broadcastRoomUsers(room.id);
                socket.emit("sync_state", room.playbackState);
            });

            socket.on("joinRoom", (userObj: { username: string; roomid: string }) => {
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

                const syncPayload = {
                    ...room.playbackState,
                    currentTime: liveTime
                };

                // Send latest live sync state to joining participant
                socket.emit("sync_state", syncPayload);
                socket.emit("playlistUpdated", room.playlist);
            });

            // ------------------------------------------------------------------
            // 2. Playback Synchronization (Backend Permission Enforced)
            // ------------------------------------------------------------------
            socket.on("videoPaused", () => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

                const perm = room.validatePermission(socket.id, "pause");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }

                room.playbackState.isPlaying = false;
                room.playbackState.updatedAt = Date.now();
                socket.to(room.id).emit("videoPaused");
            });

            socket.on("videoPlaying", (currentTime: number) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

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

            socket.on("seek", (currentTime: number) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

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
                if (!room) return;

                const perm = room.validatePermission(socket.id, "change_video");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }

                this.io.to(room.id).emit("playNextVideo");
            });

            socket.on("playPreviousVideo", () => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

                const perm = room.validatePermission(socket.id, "change_video");
                if (!perm.allowed) {
                    socket.emit("permission_error", { message: perm.reason });
                    return;
                }

                this.io.to(room.id).emit("playPreviousVideo");
            });

            socket.on("playVideoDirectly", (videoObj: any) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room || !videoObj || !videoObj.video_id) return;

                room.playbackState.videoId = videoObj.video_id;
                room.playbackState.videoObj = videoObj;
                room.playbackState.currentTime = 0;
                room.playbackState.isPlaying = true;
                room.playbackState.updatedAt = Date.now();

                // Broadcast new video and live sync state to all room members
                this.io.to(room.id).emit("playVideoDirectly", videoObj);
                this.io.to(room.id).emit("sync_state", room.playbackState);
            });

            socket.on("playlistUpdated", (updatedPlaylist: any) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

                room.playlist = updatedPlaylist;
                this.io.to(room.id).emit("playlistUpdated", updatedPlaylist);
            });

            // ------------------------------------------------------------------
            // 3. Host Capabilities & RBAC Management
            // ------------------------------------------------------------------
            socket.on("assign_role", (data: { targetSocketId: string; role: Role }) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

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

            socket.on("transfer_host", (data: { targetSocketId: string }) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

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

            socket.on("remove_participant", (data: { targetSocketId: string }) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

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
            socket.on("request_action", (data: { type: 'change_video' | 'play_request'; payload: any }) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

                const req = room.submitApprovalRequest(socket.id, data.type, data.payload);
                if (!req) return;

                // Send request notification to Host and Moderators
                room.participants.forEach(p => {
                    if (p.role === Role.HOST || p.role === Role.MODERATOR) {
                        this.io.to(p.id).emit("approval_request_received", req);
                    }
                });
            });

            socket.on("handle_request", (data: { requestId: string; approve: boolean }) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (!room) return;

                const res = room.handleApprovalRequest(socket.id, data.requestId, data.approve);
                if (!res.success || !res.req) {
                    socket.emit("permission_error", { message: res.message });
                    return;
                }

                const req = res.req;
                if (data.approve) {
                    if (req.type === 'change_video') {
                        room.playbackState.videoId = req.payload.video_id;
                        this.io.to(room.id).emit("playVideoDirectly", req.payload);
                    }
                    this.io.to(room.id).emit("message", {
                        username: "System",
                        text: `Host approved ${req.username}'s video request!`
                    });
                }
            });

            // ------------------------------------------------------------------
            // 5. Chat & Connection Disconnect
            // ------------------------------------------------------------------
            socket.on("sendMessage", (message: string, callback: Function) => {
                const room = this.roomManager.getRoomBySocketId(socket.id);
                if (room) {
                    const participant = room.getParticipant(socket.id);
                    const name = participant ? participant.username : 'Guest';
                    const isHost = participant ? (participant.role === Role.HOST || (participant.role as string) === 'ADMIN') : false;
                    this.io.to(room.id).emit("message", {
                        username: name,
                        text: message,
                        senderId: socket.id,
                        isHost: isHost,
                        timestamp: Date.now()
                    });
                }
                if (typeof callback === 'function') callback();
            });

            socket.on("disconnect", () => {
                const { room, participant } = this.roomManager.leaveRoom(socket.id);
                if (room && participant) {
                    this.io.to(room.id).emit("message", {
                        username: "System",
                        text: `${participant.username} left the room.`
                    });
                    this.broadcastRoomUsers(room.id);
                }
            });
        });
    }

    private broadcastRoomUsers(roomId: string): void {
        const room = this.roomManager.getRoom(roomId);
        if (room) {
            this.io.to(roomId).emit("roomUsersList", {
                usersList: room.getParticipantsList(),
                hostSocketId: room.hostSocketId
            });
        }
    }
}
