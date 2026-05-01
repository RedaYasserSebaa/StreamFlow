const express = require("express");
const fs = require("fs");
const path = require("path");
const torrentStream = require("torrent-stream");
const { CONFIG, activeStreams } = require("../state");
const authenticateToken = require("../middleware/auth");
const { getContentType } = require("../utils/media");
const TRACKER_LIST = require("../trackers");

const router = express.Router();

// Stream Endpoint
router.get("/api/stream", authenticateToken, async (req, res) => {
  const { magnet } = req.query;
  if (!magnet) {
    return res.status(400).send("No magnet provided");
  }

  let engine = activeStreams.get(magnet);
  if (!engine) {
    const torrentOpts = {
      connections: 500, // High connection limit to maximize swarm utilization
      uploads: 10,      // Need sufficient uploads to satisfy BitTorrent tit-for-tat and unchoke fast peers
      dht: true,
      tracker: true,
      trackers: TRACKER_LIST
    };
    engine = torrentStream(magnet, torrentOpts);
    activeStreams.set(magnet, engine);

    engine.on('ready', () => {
      console.log(`Engine ready`);
    });
  }

  if (!engine.torrent) {
    await new Promise(resolve => engine.on('ready', resolve));
  }

  const file = engine.files.reduce((a, b) => a.length > b.length ? a : b);
  file.select(); // Prioritize downloading the entire file to saturate bandwidth, stream will prioritize specific chunks

  const range = req.headers.range;
  const contentType = getContentType(file.name);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const partialstart = parts[0];
    const partialend = parts[1];

    const start = parseInt(partialstart, 10);
    const end = partialend ? parseInt(partialend, 10) : file.length - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${file.length}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
    });

    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
    stream.on("error", (err) => console.log("Stream err:", err));
    req.on("close", () => {
      stream.destroy();
    });
  } else {
    res.writeHead(200, {
      "Content-Length": file.length,
      "Content-Type": contentType,
    });

    const stream = file.createReadStream();
    stream.pipe(res);
    stream.on("error", (err) => console.log("Stream err:", err));
    req.on("close", () => {
      stream.destroy();
    });
  }
});

// Local Stream Endpoint
router.get("/api/stream/local", authenticateToken, (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  // Security check: path must be within movies_path or tv_shows_path
  const isAllowed = (CONFIG.movies_path && filePath.startsWith(path.resolve(CONFIG.movies_path))) ||
                    (CONFIG.tv_shows_path && filePath.startsWith(path.resolve(CONFIG.tv_shows_path)));
  
  if (!isAllowed) {
    return res.status(403).send("Access denied");
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getContentType(filePath);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    // Cap chunk size to 10MB to prevent memory bloat and buffering issues
    const MAX_CHUNK_SIZE = 10 * 1024 * 1024;
    const end = Math.min(requestedEnd, start + MAX_CHUNK_SIZE - 1);
    
    const chunksize = (end - start) + 1;
    // Increase highWaterMark to 5MB for smoother I/O reading
    const file = fs.createReadStream(filePath, { start, end, highWaterMark: 5 * 1024 * 1024 });

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
    req.on("close", () => {
      file.destroy();
    });
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    // Increase highWaterMark to 5MB for smoother I/O reading
    const file = fs.createReadStream(filePath, { highWaterMark: 5 * 1024 * 1024 });
    file.pipe(res);
    req.on("close", () => {
      file.destroy();
    });
  }
});

// Stream Stats Endpoint
router.get("/api/stream/stats", (req, res) => {
  const { magnet } = req.query;
  if (!magnet) {
    return res.status(400).json({ error: "No magnet provided" });
  }

  const engine = activeStreams.get(magnet);
  if (!engine || !engine.swarm) {
    return res.json({ speed: 0, peers: 0, downloaded: 0, progress: 0 });
  }

  const speed = typeof engine.swarm.downloadSpeed === 'function' ? engine.swarm.downloadSpeed() : 0;
  const peers = engine.swarm.wires ? engine.swarm.wires.length : 0;
  const downloaded = engine.swarm.downloaded || 0;
  const total = engine.torrent ? engine.torrent.length : 0;
  const progress = total > 0 ? ((downloaded / total) * 100).toFixed(2) : 0;

  res.json({ speed, peers, downloaded, progress });
});

module.exports = router;
