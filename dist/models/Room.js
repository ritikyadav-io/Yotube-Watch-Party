"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const Participant_1 = require("./Participant");
class Room {
    constructor(id, hostParticipant) {
        this.participants = new Map();
        this.playlist = [];
        this.history = [];
        this.pendingRequests = new Map();
        this.id = id;
        this.hostSocketId = hostParticipant.id;
        hostParticipant.role = Participant_1.Role.HOST;
        this.participants.set(hostParticipant.id, hostParticipant);
        const defaultVideo = {
            title: "Shawn Mendes - Treat You Better",
            channel: "Shawn Mendes",
            thumbnail_url: "https://i.ytimg.com/vi/sQVeK7dT18Y/hqdefault.jpg",
            video_url: "https://www.youtube.com/watch?v=sQVeK7dT18Y",
            video_id: "sQVeK7dT18Y"
        };
        this.playbackState = {
            videoId: 'sQVeK7dT18Y',
            videoObj: defaultVideo,
            currentTime: 0,
            isPlaying: false,
            lastUpdatedBy: hostParticipant.username,
            updatedAt: Date.now()
        };
    }
    addParticipant(participant) {
        // If room has no active host, promote first user to Host
        if (this.participants.size === 0) {
            participant.role = Participant_1.Role.HOST;
            this.hostSocketId = participant.id;
        }
        else {
            participant.role = Participant_1.Role.PARTICIPANT;
        }
        this.participants.set(participant.id, participant);
    }
    removeParticipant(socketId) {
        const participant = this.participants.get(socketId);
        if (!participant)
            return undefined;
        this.participants.delete(socketId);
        // Auto-transfer Host if Host left the room
        if (socketId === this.hostSocketId && this.participants.size > 0) {
            this.autoTransferHost();
        }
        return participant;
    }
    autoTransferHost() {
        // Search for Moderators first, then Participants
        let newHost;
        for (const p of this.participants.values()) {
            if (p.role === Participant_1.Role.MODERATOR) {
                newHost = p;
                break;
            }
        }
        if (!newHost && this.participants.size > 0) {
            newHost = Array.from(this.participants.values())[0];
        }
        if (newHost) {
            newHost.role = Participant_1.Role.HOST;
            this.hostSocketId = newHost.id;
        }
    }
    getParticipant(socketId) {
        return this.participants.get(socketId);
    }
    isHost(socketId) {
        return this.hostSocketId === socketId;
    }
    validatePermission(socketId, action) {
        const participant = this.participants.get(socketId);
        if (!participant) {
            return { allowed: false, reason: "User not found in room." };
        }
        if (!participant.hasPermission(action)) {
            return {
                allowed: false,
                reason: `Permission denied. Your role (${participant.role}) cannot perform action: ${action}.`
            };
        }
        return { allowed: true };
    }
    assignRole(executorSocketId, targetSocketId, newRole) {
        const executor = this.participants.get(executorSocketId);
        if (!executor || (executor.role !== Participant_1.Role.HOST && executor.role !== 'ADMIN')) {
            return { success: false, message: "Only the Room Host can assign roles." };
        }
        const target = this.participants.get(targetSocketId);
        if (!target) {
            return { success: false, message: "Target user not found." };
        }
        if (targetSocketId === this.hostSocketId && newRole !== Participant_1.Role.HOST) {
            return { success: false, message: "Cannot demote Host directly. Transfer host role first." };
        }
        target.role = newRole;
        return { success: true };
    }
    transferHost(currentHostSocketId, targetSocketId) {
        if (currentHostSocketId !== this.hostSocketId) {
            return { success: false, message: "Only the current Host can transfer host privileges." };
        }
        const target = this.participants.get(targetSocketId);
        if (!target) {
            return { success: false, message: "Target user not found." };
        }
        const currentHost = this.participants.get(currentHostSocketId);
        if (currentHost)
            currentHost.role = Participant_1.Role.MODERATOR;
        target.role = Participant_1.Role.HOST;
        this.hostSocketId = target.id;
        return { success: true };
    }
    kickParticipant(hostSocketId, targetSocketId) {
        const executor = this.participants.get(hostSocketId);
        if (!executor || (executor.role !== Participant_1.Role.HOST && executor.role !== 'ADMIN')) {
            return { success: false, message: "Only the Room Host can kick participants." };
        }
        if (targetSocketId === hostSocketId) {
            return { success: false, message: "Host cannot kick themselves." };
        }
        const target = this.participants.get(targetSocketId);
        if (!target) {
            return { success: false, message: "Target user not found." };
        }
        this.participants.delete(targetSocketId);
        return { success: true, kickedUser: target };
    }
    submitApprovalRequest(participantSocketId, type, payload) {
        const participant = this.participants.get(participantSocketId);
        if (!participant)
            return undefined;
        const req = {
            id: 'REQ_' + Math.random().toString(36).substring(2, 9),
            participantSocketId,
            username: participant.username,
            type,
            payload,
            timestamp: Date.now()
        };
        this.pendingRequests.set(req.id, req);
        return req;
    }
    handleApprovalRequest(executorSocketId, requestId, approve) {
        const perm = this.validatePermission(executorSocketId, 'play');
        if (!perm.allowed) {
            return { success: false, message: "Only Host or Moderators can approve/reject requests." };
        }
        const req = this.pendingRequests.get(requestId);
        if (!req) {
            return { success: false, message: "Request expired or not found." };
        }
        this.pendingRequests.delete(requestId);
        return { success: true, req };
    }
    getParticipantsList() {
        return Array.from(this.participants.values()).map(p => p.toJSON());
    }
    getRoomSummary() {
        return {
            id: this.id,
            hostSocketId: this.hostSocketId,
            playbackState: this.playbackState,
            participantsCount: this.participants.size,
            participants: this.getParticipantsList(),
            playlist: this.playlist
        };
    }
}
exports.Room = Room;
