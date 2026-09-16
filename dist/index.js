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
// Enable CORS for all REST requests
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
    }
    next();
});
const path_1 = __importDefault(require("path"));
const publicPath = path_1.default.join(__dirname, '../public');
app.use(express_1.default.static(publicPath));
app.use(express_1.default.static('public'));
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.json());
// Explicit Static File Routes for Vercel & Express fallback
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'index.html'));
});
app.get('/index.html', (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'index.html'));
});
app.get('/room.html', (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'room.html'));
});
// Initialize Socket.IO with CORS
const io = new socket_io_1.default.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
// Express REST endpoint for room checking & browser redirection
app.get("/room", (req, res) => {
    const isJsonRequest = req.headers.accept && req.headers.accept.includes('application/json');
    const username = req.query.username || '';
    const roomid = req.query.roomid || '';
    if (isJsonRequest) {
        res.setHeader("Content-Type", "application/json");
        const roomManager = RoomManager_1.RoomManager.getInstance();
        if (!roomid || !roomManager.checkIfRoomExists(roomid.trim())) {
            res.status(200).json({ error: true, message: "Room ID does not exist. Please check the code." });
        }
        else {
            res.status(200).json({ error: false });
        }
        return;
    }
    // Standard Browser Request: Redirect to /room.html with query parameters preserved
    const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(302, `/room.html${queryStr}`);
});
// Initialize OOP MessageHandler for Socket.IO
const messageHandler = new MessageHandler_1.MessageHandler(io);
messageHandler.registerSocketEvents();
httpServer.listen(port, () => {
    console.log(`YouTube Party Server is running on port ${port}...`);
});
