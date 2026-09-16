export enum Role {
    HOST = 'HOST',
    MODERATOR = 'MODERATOR',
    PARTICIPANT = 'PARTICIPANT'
}

export class Participant {
    public id: string; // Socket ID
    public username: string;
    public roomId: string;
    public role: Role;
    public joinedAt: Date;

    constructor(id: string, username: string, roomId: string, role: Role = Role.PARTICIPANT) {
        this.id = id;
        const cleanName = (username && typeof username === 'string') ? username.trim() : '';
        this.username = cleanName || `Guest-${id.substring(0, 4)}`;
        this.roomId = (roomId && typeof roomId === 'string') ? roomId.trim() : '';
        this.role = role;
        this.joinedAt = new Date();
    }

    /**
     * Role-Based Permission Check
     */
    public hasPermission(action: string): boolean {
        // HOST (or legacy ADMIN) has unrestricted control
        if (this.role === Role.HOST || (this.role as string) === 'ADMIN') {
            return true;
        }

        // MODERATOR can control playback (play, pause, seek, change video)
        if (this.role === Role.MODERATOR) {
            const allowedModeratorActions = ['play', 'pause', 'seek', 'change_video', 'playlist_update'];
            return allowedModeratorActions.includes(action);
        }

        // PARTICIPANTS have no direct control permissions (watch-only)
        return false;
    }

    public toJSON() {
        return {
            id: this.id,
            username: this.username,
            roomId: this.roomId,
            role: this.role,
            joinedAt: this.joinedAt
        };
    }
}
