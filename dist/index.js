"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = __importDefault(require("socket.io"));
const MessageHandler_1 = require("./controllers/MessageHandler");
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
// YouTube Real-time Search Proxy (Official API Key with public renderer fallback)
app.get("/api/youtube/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const query = (req.query.q || 'famous english songs').trim();
    const userApiKey = req.headers['x-youtube-api-key'] || req.query.key || process.env.YOUTUBE_API_KEY || '';
    // 1. Try official YouTube Data API v3 if API key is provided
    if (userApiKey) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${userApiKey}`;
            const apiRes = yield fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = yield apiRes.json();
            if (data.items && data.items.length > 0) {
                const videos = data.items
                    .filter((item) => item.id && item.id.videoId)
                    .map((item) => ({
                    id: item.id.videoId,
                    title: item.snippet.title,
                    channel: item.snippet.channelTitle,
                    thumbnail: `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`
                }));
                if (videos.length > 0) {
                    res.json({ success: true, videos });
                    return;
                }
            }
        }
        catch (err) {
            console.warn("API Key lookup failed, falling back to public search renderer:", err);
        }
    }
    // 2. Fallback: Parse live YouTube search results directly
    try {
        const ytRes = yield fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = yield ytRes.text();
        const idx = html.indexOf('var ytInitialData = ');
        if (idx !== -1) {
            const endIdx = html.indexOf(';</script>', idx);
            const jsonStr = html.substring(idx + 20, endIdx);
            const data = JSON.parse(jsonStr);
            const contents = (_d = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.contents) === null || _a === void 0 ? void 0 : _a.twoColumnSearchResultsRenderer) === null || _b === void 0 ? void 0 : _b.primaryContents) === null || _c === void 0 ? void 0 : _c.sectionListRenderer) === null || _d === void 0 ? void 0 : _d.contents;
            if (contents && Array.isArray(contents)) {
                const videoItems = [];
                for (const section of contents) {
                    const itemSection = (_e = section === null || section === void 0 ? void 0 : section.itemSectionRenderer) === null || _e === void 0 ? void 0 : _e.contents;
                    if (itemSection && Array.isArray(itemSection)) {
                        for (const item of itemSection) {
                            if (item.videoRenderer && item.videoRenderer.videoId) {
                                const v = item.videoRenderer;
                                videoItems.push({
                                    id: v.videoId,
                                    title: ((_h = (_g = (_f = v.title) === null || _f === void 0 ? void 0 : _f.runs) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text) || 'YouTube Video',
                                    channel: ((_l = (_k = (_j = v.ownerText) === null || _j === void 0 ? void 0 : _j.runs) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.text) || ((_p = (_o = (_m = v.longBylineText) === null || _m === void 0 ? void 0 : _m.runs) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.text) || 'YouTube Channel',
                                    thumbnail: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
                                });
                            }
                        }
                    }
                }
                if (videoItems.length > 0) {
                    res.json({ success: true, videos: videoItems.slice(0, 15) });
                    return;
                }
            }
        }
    }
    catch (err) {
        console.warn("Public YouTube search failed:", err);
    }
    res.json({ success: false, videos: [] });
}));
// Express REST endpoint for room checking & browser redirection
app.get("/room", (req, res) => {
    const isJsonRequest = req.headers.accept && req.headers.accept.includes('application/json');
    const username = req.query.username || '';
    const roomid = req.query.roomid || '';
    if (isJsonRequest) {
        res.setHeader("Content-Type", "application/json");
        res.status(200).json({ error: false });
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
