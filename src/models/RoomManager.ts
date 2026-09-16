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
        const roomId = generateRoomID();
        const rawName = (username && typeof username === 'string') ? username.trim() : '';
        const hostName = rawName || `Host-${socketId.substring(0, 4)}`;
        const host = new Participant(socketId, hostName, roomId, Role.HOST);
        const room = new Room(roomId, host);

        this.rooms.set(roomId, room);
        this.socketToRoom.set(socketId, roomId);

        return { room, host };
    }

    public joinRoom(roomId: string, username: string, socketId: string): { success: boolean; room?: Room; participant?: Participant; error?: string } {
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

        const participant = new Participant(socketId, finalName, roomId, Role.PARTICIPANT);
        room.addParticipant(participant);
        this.socketToRoom.set(socketId, roomId);

        return { success: true, room, participant };
    }

    public getRoom(roomId: string): Room | undefined {
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

    public checkIfUserExists(username: string, roomId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        return room.getParticipantsList().some(p => p.username.toLowerCase() === username.trim().toLowerCase());
    }

    public checkIfRoomExists(roomId: string): boolean {
        return this.rooms.has(roomId);
    }
}
