import { Room } from './Room';
import { Participant, Role } from './Participant';
import { generateRoomID } from '../utils/generateRoomID';

export class RoomManager {
    private static instance: RoomManager;
    private rooms: Map<string, Room> = new Map();
    private socketToRoom: Map<string, string> = new Map();

    private constructor() {}

    public static getInstance(): RoomManager {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }

    public createRoom(username: string, socketId: string): { room: Room; host: Participant } {
        const roomId = generateRoomID().trim().toUpperCase();
        const rawName = (username && typeof username === 'string') ? username.trim() : '';
        const hostName = rawName || `Host-${socketId.substring(0, 4)}`;
        const host = new Participant(socketId, hostName, roomId, Role.HOST);
        const room = new Room(roomId, host);

        this.rooms.set(roomId, room);
        this.socketToRoom.set(socketId, roomId);

        return { room, host };
    }

    public joinRoom(rawRoomId: string, username: string, socketId: string): { success: boolean; room?: Room; participant?: Participant; error?: string } {
        const roomId = (rawRoomId && typeof rawRoomId === 'string') ? rawRoomId.trim().toUpperCase() : generateRoomID().trim().toUpperCase();
        let room = this.rooms.get(roomId);

        // If room does not exist yet, auto-create it with this roomId so users can seamlessly join without "Room does not exist" error
        if (!room) {
            const rawName = (username && typeof username === 'string') ? username.trim() : '';
            const hostName = rawName || `Host-${socketId.substring(0, 4)}`;
            const host = new Participant(socketId, hostName, roomId, Role.HOST);
            room = new Room(roomId, host);
            this.rooms.set(roomId, room);
            this.socketToRoom.set(socketId, roomId);
            return { success: true, room, participant: host };
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

        const participant = new Participant(socketId, finalName, roomId, Role.PARTICIPANT);
        room.addParticipant(participant);
        this.socketToRoom.set(socketId, roomId);

        return { success: true, room, participant };
    }

    public getRoom(rawRoomId: string): Room | undefined {
        if (!rawRoomId) return undefined;
        const roomId = rawRoomId.trim().toUpperCase();
        return this.rooms.get(roomId);
    }

    public getRoomBySocketId(socketId: string): Room | undefined {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return undefined;
        return this.rooms.get(roomId);
    }

    public leaveRoom(socketId: string): { room?: Room; participant?: Participant } {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return {};

        const room = this.rooms.get(roomId);
        this.socketToRoom.delete(socketId);

        if (!room) return {};

        const participant = room.removeParticipant(socketId);

        // Delete empty room
        if (room.participants.size === 0) {
            this.rooms.delete(roomId);
        }

        return { room, participant };
    }

    public checkIfUserExists(username: string, rawRoomId: string): boolean {
        if (!rawRoomId) return false;
        const roomId = rawRoomId.trim().toUpperCase();
        const room = this.rooms.get(roomId);
        if (!room) return false;
        return room.getParticipantsList().some(p => p.username.toLowerCase() === username.trim().toLowerCase());
    }

    public checkIfRoomExists(rawRoomId: string): boolean {
        if (!rawRoomId) return false;
        const roomId = rawRoomId.trim().toUpperCase();
        return this.rooms.has(roomId);
    }
}
