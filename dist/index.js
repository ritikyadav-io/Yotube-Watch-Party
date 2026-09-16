"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = __importDefault(require("socket.io"));
const MessageHandler_1 = require("./controllers/MessageHandler");
const RoomManager_1 = require("./models/RoomManager");
const app = express_1.default();
const port = process.env.PORT || 3000;
const httpServer = http_1.createServer(app);
const io = new socket_io_1.default.Server(httpServer);
app.use(express_1.default.static('public'));
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.json());
// Express REST endpoint for room checking
app.get("/room", (req, res) => {
    const username = req.query.username || '';
    const roomid = req.query.roomid || '';
    const roomManager = RoomManager_1.RoomManager.getInstance();
    if (!roomManager.checkIfRoomExists(roomid)) {
        res.end(JSON.stringify({ error: true, message: "Please enter a valid Room ID." }));
    }
    else {
        res.end(JSON.stringify({ error: false }));
    }
});
// Initialize OOP MessageHandler for Socket.IO
const messageHandler = new MessageHandler_1.MessageHandler(io);
messageHandler.registerSocketEvents();
httpServer.listen(port, () => {
    console.log(`YouTube Party Server is running on port ${port}...`);
});
