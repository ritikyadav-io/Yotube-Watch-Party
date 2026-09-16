"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Participant = exports.Role = void 0;
var Role;
(function (Role) {
    Role["HOST"] = "HOST";
    Role["MODERATOR"] = "MODERATOR";
    Role["PARTICIPANT"] = "PARTICIPANT";
})(Role = exports.Role || (exports.Role = {}));
class Participant {
    constructor(id, username, roomId, role = Role.PARTICIPANT) {
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
    hasPermission(action) {
        // HOST (or legacy ADMIN) has unrestricted control
        if (this.role === Role.HOST || this.role === 'ADMIN') {
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
    toJSON() {
        return {
            id: this.id,
            username: this.username,
            roomId: this.roomId,
            role: this.role,
            joinedAt: this.joinedAt
        };
    }
}
exports.Participant = Participant;
