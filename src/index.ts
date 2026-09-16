import express from 'express';
import { createServer } from "http";
import socketIO from "socket.io";
import { MessageHandler } from './controllers/MessageHandler';
import { RoomManager } from './models/RoomManager';

const app: express.Application = express();
const port: string | number = process.env.PORT || 3000;
const httpServer = createServer(app);

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

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Initialize Socket.IO with CORS
const io = new socketIO.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Express REST endpoint for room checking
app.get("/room", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const username: string = (req.query.username as string) || '';
    const roomid: string = (req.query.roomid as string) || '';

    const roomManager = RoomManager.getInstance();

    if (!roomid || !roomManager.checkIfRoomExists(roomid.trim())) {
        res.status(200).json({ error: true, message: "Room ID does not exist. Please check the code." });
    } else {
        res.status(200).json({ error: false });
    }
});

// Initialize OOP MessageHandler for Socket.IO
const messageHandler = new MessageHandler(io);
messageHandler.registerSocketEvents();

httpServer.listen(port, () => {
    console.log(`YouTube Party Server is running on port ${port}...`);
});