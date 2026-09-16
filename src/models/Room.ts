import { Participant, Role } from './Participant';

export interface VideoItem {
    title: string;
    channel: string;
    thumbnail_url: string;
    video_url: string;
    video_id: string;
}

export interface PlaybackState {
    videoId: string;
    videoObj?: VideoItem | any;
    currentTime: number;
    isPlaying: boolean;
    lastUpdatedBy: string;
    updatedAt: number;
}

export interface ApprovalRequest {
    id: string;
    participantSocketId: string;
    username: string;
    type: 'change_video' | 'play_request';
    payload: any;
    timestamp: number;
}

export class Room {
    public id: string;
    public hostSocketId: string;
    public participants: Map<string, Participant> = new Map();
    public playbackState: PlaybackState;
    public playlist: VideoItem[] = [];
    public history: VideoItem[] = [];
    public pendingRequests: Map<string, ApprovalRequest> = new Map();

    constructor(id: string, hostParticipant: Participant) {
        this.id = id;
        this.hostSocketId = hostParticipant.id;
        hostParticipant.role = Role.HOST;
        this.participants.set(hostParticipant.id, hostParticipant);

        const defaultVideo = {
            title: "Ed Sheeran - Shape of You",
            channel: "Ed Sheeran",
            thumbnail_url: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
            video_url: "https://www.youtube.com/watch?v=JGwWNGJdvx8",
            video_id: "JGwWNGJdvx8"
        };

        this.playbackState = {
            videoId: 'JGwWNGJdvx8',
            videoObj: defaultVideo,
            currentTime: 0,
            isPlaying: true,
            lastUpdatedBy: hostParticipant.username,
            updatedAt: Date.now()
        };
    }

    public addParticipant(participant: Participant): void {
        // If room has no active host, promote first user to Host
        if (this.participants.size === 0) {
            participant.role = Role.HOST;
            this.hostSocketId = participant.id;
        } else {
            participant.role = Role.PARTICIPANT;
        }
        this.participants.set(participant.id, participant);
    }

    public removeParticipant(socketId: string): Participant | undefined {
        const participant = this.participants.get(socketId);
        if (!participant) return undefined;

        this.participants.delete(socketId);

        // Auto-transfer Host if Host left the room
        if (socketId === this.hostSocketId && this.participants.size > 0) {
            this.autoTransferHost();
        }

        return participant;
    }

    private autoTransferHost(): void {
        // Search for Moderators first, then Participants
        let newHost: Participant | undefined;
        for (const p of this.participants.values()) {
            if (p.role === Role.MODERATOR) {
                newHost = p;
                break;
            }
        }

        if (!newHost && this.participants.size > 0) {
            newHost = Array.from(this.participants.values())[0];
        }

        if (newHost) {
            newHost.role = Role.HOST;
            this.hostSocketId = newHost.id;
        }
    }

    public getParticipant(socketId: string): Participant | undefined {
        return this.participants.get(socketId);
    }

    public isHost(socketId: string): boolean {
        return this.hostSocketId === socketId;
    }

    public validatePermission(socketId: string, action: string): { allowed: boolean; reason?: string } {
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

    public assignRole(executorSocketId: string, targetSocketId: string, newRole: Role): { success: boolean; message?: string } {
        const executor = this.participants.get(executorSocketId);
        if (!executor || (executor.role !== Role.HOST && (executor.role as string) !== 'ADMIN')) {
            return { success: false, message: "Only the Room Host can assign roles." };
        }

        const target = this.participants.get(targetSocketId);
        if (!target) {
            return { success: false, message: "Target user not found." };
        }

        if (targetSocketId === this.hostSocketId && newRole !== Role.HOST) {
            return { success: false, message: "Cannot demote Host directly. Transfer host role first." };
        }

        target.role = newRole;
        return { success: true };
    }

    public transferHost(currentHostSocketId: string, targetSocketId: string): { success: boolean; message?: string } {
        if (currentHostSocketId !== this.hostSocketId) {
            return { success: false, message: "Only the current Host can transfer host privileges." };
        }

        const target = this.participants.get(targetSocketId);
        if (!target) {
            return { success: false, message: "Target user not found." };
        }

        const currentHost = this.participants.get(currentHostSocketId);
        if (currentHost) currentHost.role = Role.MODERATOR;

        target.role = Role.HOST;
        this.hostSocketId = target.id;

        return { success: true };
    }

    public kickParticipant(hostSocketId: string, targetSocketId: string): { success: boolean; kickedUser?: Participant; message?: string } {
        const executor = this.participants.get(hostSocketId);
        if (!executor || (executor.role !== Role.HOST && (executor.role as string) !== 'ADMIN')) {
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

    public submitApprovalRequest(participantSocketId: string, type: 'change_video' | 'play_request', payload: any): ApprovalRequest | undefined {
        const participant = this.participants.get(participantSocketId);
        if (!participant) return undefined;

        const req: ApprovalRequest = {
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

    public handleApprovalRequest(executorSocketId: string, requestId: string, approve: boolean): { success: boolean; req?: ApprovalRequest; message?: string } {
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

    public getParticipantsList() {
        return Array.from(this.participants.values()).map(p => p.toJSON());
    }

    public getRoomSummary() {
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
