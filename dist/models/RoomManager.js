"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const Room_1 = require("./Room");
const Participant_1 = require("./Participant");
const generateRoomID_1 = require("../utils/generateRoomID");
class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.socketToRoom = new Map();
        this.roomCleanupTimers = new Map();
    }
    static getInstance() {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }
    createRoom(username, socketId) {
        const roomId = generateRoomID_1.generateRoomID().trim().toUpperCase();
        const rawName = (username && typeof username === 'string') ? username.trim() : '';
        const hostName = rawName || `Host-${socketId.substring(0, 4)}`;
        const host = new Participant_1.Participant(socketId, hostName, roomId, Participant_1.Role.HOST);
        const room = new Room_1.Room(roomId, host);
        this.rooms.set(roomId, room);
        this.socketToRoom.set(socketId, roomId);
        return { room, host };
    }
    getRoom(rawRoomId) {
        if (!rawRoomId)
            return undefined;
        const roomId = rawRoomId.trim().toUpperCase();
        return this.rooms.get(roomId);
    }
    getRoomBySocketId(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId)
            return undefined;
        return this.rooms.get(roomId);
    }
    leaveRoom(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId)
            return {};
        const room = this.rooms.get(roomId);
        this.socketToRoom.delete(socketId);
        if (!room)
            return {};
        const participant = room.removeParticipant(socketId);
        // Schedule 60-second grace period before deleting empty room
        // Prevents room destruction when host re-handshakes or switches transports (polling -> websocket)
        if (room.participants.size === 0) {
            if (this.roomCleanupTimers.has(roomId)) {
                clearTimeout(this.roomCleanupTimers.get(roomId));
            }
            const timer = setTimeout(() => {
                const targetRoom = this.rooms.get(roomId);
                if (targetRoom && targetRoom.participants.size === 0) {
                    this.rooms.delete(roomId);
                    console.log(`Room ${roomId} cleaned up after 60s grace period.`);
                }
                this.roomCleanupTimers.delete(roomId);
            }, 60000);
            this.roomCleanupTimers.set(roomId, timer);
        }
        return { room, participant };
    }
    joinRoom(rawRoomId, username, socketId) {
        const roomId = (rawRoomId && typeof rawRoomId === 'string') ? rawRoomId.trim().toUpperCase() : generateRoomID_1.generateRoomID().trim().toUpperCase();
        // Cancel cleanup timer if room was on grace period
        if (this.roomCleanupTimers.has(roomId)) {
            clearTimeout(this.roomCleanupTimers.get(roomId));
            this.roomCleanupTimers.delete(roomId);
        }
        let room = this.rooms.get(roomId);
        // If room does not exist yet, auto-create it with this roomId as host
        if (!room) {
            const rawName = (username && typeof username === 'string') ? username.trim() : '';
            const hostName = rawName || `Host-${socketId.substring(0, 4)}`;
            const host = new Participant_1.Participant(socketId, hostName, roomId, Participant_1.Role.HOST);
            room = new Room_1.Room(roomId, host);
            this.rooms.set(roomId, room);
            this.socketToRoom.set(socketId, roomId);
            return { success: true, room, participant: host };
        }
        const rawName = (username && typeof username === 'string') ? username.trim() : '';
        const baseName = rawName || `Guest-${socketId.substring(0, 4)}`;
        // If host or existing participant is reconnecting, re-associate them with existing room
        let roleToAssign = Participant_1.Role.PARTICIPANT;
        if (room.participants.size === 0) {
            roleToAssign = Participant_1.Role.HOST;
            room.hostSocketId = socketId;
        }
        // Auto-disambiguate duplicate names (e.g. "Alex" -> "Alex (1)")
        let finalName = baseName;
        let counter = 1;
        while (room.getParticipantsList().some(p => p.username.toLowerCase() === finalName.toLowerCase())) {
            finalName = `${baseName} (${counter})`;
            counter++;
        }
        const participant = new Participant_1.Participant(socketId, finalName, roomId, roleToAssign);
        room.addParticipant(participant);
        this.socketToRoom.set(socketId, roomId);
        return { success: true, room, participant };
    }
    checkIfUserExists(username, rawRoomId) {
        if (!rawRoomId)
            return false;
        const roomId = rawRoomId.trim().toUpperCase();
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        return room.getParticipantsList().some(p => p.username.toLowerCase() === username.trim().toLowerCase());
    }
    checkIfRoomExists(rawRoomId) {
        if (!rawRoomId)
            return false;
        const roomId = rawRoomId.trim().toUpperCase();
        return this.rooms.has(roomId);
    }
}
exports.RoomManager = RoomManager;
