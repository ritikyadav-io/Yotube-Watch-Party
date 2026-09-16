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
    }
    static getInstance() {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }
    createRoom(username, socketId) {
        const roomId = generateRoomID_1.generateRoomID();
        const rawName = (username && typeof username === 'string') ? username.trim() : '';
        const hostName = rawName || `Host-${socketId.substring(0, 4)}`;
        const host = new Participant_1.Participant(socketId, hostName, roomId, Participant_1.Role.HOST);
        const room = new Room_1.Room(roomId, host);
        this.rooms.set(roomId, room);
        this.socketToRoom.set(socketId, roomId);
        return { room, host };
    }
    joinRoom(roomId, username, socketId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: "Room ID does not exist." };
        }
        const rawName = (username && typeof username === 'string') ? username.trim() : '';
        const baseName = rawName || `Guest-${socketId.substring(0, 4)}`;
        // Auto-disambiguate duplicate names (e.g. "Alex" -> "Alex (1)")
        let finalName = baseName;
        let counter = 1;
        while (room.getParticipantsList().some(p => p.username.toLowerCase() === finalName.toLowerCase())) {
            finalName = `${baseName} (${counter})`;
            counter++;
        }
        const participant = new Participant_1.Participant(socketId, finalName, roomId, Participant_1.Role.PARTICIPANT);
        room.addParticipant(participant);
        this.socketToRoom.set(socketId, roomId);
        return { success: true, room, participant };
    }
    getRoom(roomId) {
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
        // Delete empty room
        if (room.participants.size === 0) {
            this.rooms.delete(roomId);
        }
        return { room, participant };
    }
    checkIfUserExists(username, roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        return room.getParticipantsList().some(p => p.username.toLowerCase() === username.trim().toLowerCase());
    }
    checkIfRoomExists(roomId) {
        return this.rooms.has(roomId);
    }
}
exports.RoomManager = RoomManager;
