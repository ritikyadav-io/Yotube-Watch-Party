import express from 'express';
import { createServer } from "http";
import socketIO from "socket.io";
import { MessageHandler } from './controllers/MessageHandler';
import { RoomManager } from './models/RoomManager';

const app: express.Application = express();
const port: string | number = process.env.PORT || 3000;
const httpServer = createServer(app);
const io = new socketIO.Server(httpServer);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Express REST endpoint for room checking
app.get("/room", (req, res) => {
    const username: string = (req.query.username as string) || '';
    const roomid: string = (req.query.roomid as string) || '';

    const roomManager = RoomManager.getInstance();

    if (!roomManager.checkIfRoomExists(roomid)) {
        res.end(JSON.stringify({ error: true, message: "Please enter a valid Room ID." }));
    } else {
        res.end(JSON.stringify({ error: false }));
    }
});

// Initialize OOP MessageHandler for Socket.IO
const messageHandler = new MessageHandler(io);
messageHandler.registerSocketEvents();

httpServer.listen(port, () => {
    console.log(`YouTube Party Server is running on port ${port}...`);
});