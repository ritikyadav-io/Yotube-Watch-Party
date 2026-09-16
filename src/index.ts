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

import path from 'path';

const publicPath = path.join(__dirname, '../public');

app.use(express.static(publicPath));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Explicit Static File Routes for Vercel & Express fallback
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/room.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'room.html'));
});

// Initialize Socket.IO with CORS
const io = new socketIO.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// YouTube Real-time Search Proxy (Official API Key with public renderer fallback)
app.get("/api/youtube/search", async (req, res) => {
    const query = (req.query.q as string || 'famous english songs').trim();
    const userApiKey = (req.headers['x-youtube-api-key'] as string) || (req.query.key as string) || process.env.YOUTUBE_API_KEY || '';

    // 1. Try official YouTube Data API v3 if API key is provided
    if (userApiKey) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${userApiKey}`;
            const apiRes = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await apiRes.json();
            if (data.items && data.items.length > 0) {
                const videos = data.items
                    .filter((item: any) => item.id && item.id.videoId)
                    .map((item: any) => ({
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
        } catch (err) {
            console.warn("API Key lookup failed, falling back to public search renderer:", err);
        }
    }

    // 2. Fallback: Parse live YouTube search results directly
    try {
        const ytRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = await ytRes.text();
        const idx = html.indexOf('var ytInitialData = ');
        if (idx !== -1) {
            const endIdx = html.indexOf(';</script>', idx);
            const jsonStr = html.substring(idx + 20, endIdx);
            const data = JSON.parse(jsonStr);
            const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            if (contents && Array.isArray(contents)) {
                const videoItems: Array<{ id: string; title: string; channel: string; thumbnail: string }> = [];
                for (const section of contents) {
                    const itemSection = section?.itemSectionRenderer?.contents;
                    if (itemSection && Array.isArray(itemSection)) {
                        for (const item of itemSection) {
                            if (item.videoRenderer && item.videoRenderer.videoId) {
                                const v = item.videoRenderer;
                                videoItems.push({
                                    id: v.videoId,
                                    title: v.title?.runs?.[0]?.text || 'YouTube Video',
                                    channel: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'YouTube Channel',
                                    thumbnail: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
                                });
                            } else if (item.shelfRenderer?.content?.verticalListRenderer?.items) {
                                for (const subItem of item.shelfRenderer.content.verticalListRenderer.items) {
                                    if (subItem.videoRenderer && subItem.videoRenderer.videoId) {
                                        const subV = subItem.videoRenderer;
                                        videoItems.push({
                                            id: subV.videoId,
                                            title: subV.title?.runs?.[0]?.text || 'YouTube Video',
                                            channel: subV.ownerText?.runs?.[0]?.text || subV.longBylineText?.runs?.[0]?.text || 'YouTube Channel',
                                            thumbnail: `https://img.youtube.com/vi/${subV.videoId}/hqdefault.jpg`
                                        });
                                    }
                                }
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
    } catch (err) {
        console.warn("Public YouTube search failed:", err);
    }

    res.json({ success: false, videos: [] });
});

// Express REST endpoint for room checking & browser redirection
app.get("/room", (req, res) => {
    const isJsonRequest = req.headers.accept && req.headers.accept.includes('application/json');
    const username: string = (req.query.username as string) || '';
    const roomid: string = (req.query.roomid as string) || '';

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
const messageHandler = new MessageHandler(io);
messageHandler.registerSocketEvents();

httpServer.listen(port, () => {
    console.log(`YouTube Party Server is running on port ${port}...`);
});