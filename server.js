const express = require("express");
const cors = require("cors");
const { default: got } = require("got");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const torrentStream = require("torrent-stream");

const app = express();

// Load or create configuration
const CONFIG_FILE = path.join(__dirname, "config.json");
let CONFIG = {
  tmdb_api_key: process.env.TMDB_API_KEY || null,
  jackett_api_key: process.env.JACKETT_API_KEY || null,
  jackett_ip: process.env.JACKETT_IP || "localhost",
  jackett_port: process.env.JACKETT_PORT || 9117,
  backend_url: process.env.BACKEND_URL || "http://localhost:7676",
};

// Load saved configuration
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    CONFIG = { ...CONFIG, ...savedConfig };
    console.log("📁 Loaded configuration from file");
  }
} catch (error) {
  console.log("⚠️  Could not load config file, using defaults");
}

// Save configuration function
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2));
    console.log("💾 Configuration saved");
  } catch (error) {
    console.error("❌ Could not save config:", error.message);
  }
}
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static frontend files

// Function to search real torrents using Jackett
async function searchTorrentMagnetLinks(title, mediaType = 'movie', seasonEpi = '') {
  // Validate required config
  if (!CONFIG.jackett_api_key || !CONFIG.jackett_ip || !CONFIG.jackett_port) {
    throw new Error("Jackett configuration not set. Please complete the setup.");
  }

  const JACKETT_URL = `http://${CONFIG.jackett_ip}:${CONFIG.jackett_port}`;
  const JACKETT_API_KEY = CONFIG.jackett_api_key;

  try {
    let categories;
    let searchQuery = title;

    if (mediaType === 'movie') {
      categories = '2000,2010,2040,2050';
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : "";
      searchQuery = year
        ? `${title.replace(year, "").trim()} ${year}`
        : `${title}`;
    } else {
      categories = '5000,5030,5040,5070';
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : "";
      let cleanTitle = year ? title.replace(year, "").trim() : title;
      if (seasonEpi) {
        searchQuery = `${cleanTitle} ${seasonEpi}`;
      } else {
        searchQuery = cleanTitle;
      }
    }

    console.log(`🔍 Querying Jackett: ${searchQuery} (Type: ${mediaType}, Cat: ${categories})`);

    const jacketUrl = `${JACKETT_URL}/api/v2.0/indexers/all/results`;
    const searchUrl = `${jacketUrl}?apikey=${JACKETT_API_KEY}&Query=${encodeURIComponent(searchQuery)}&Category=${categories}`;
    console.log(`🔗 Jackett URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.Results || data.Results.length === 0) {
      console.log(`⚠️  No results from Jackett, using mock data`);
      return getMockResults(title);
    }

    console.log(`✅ Found ${data.Results.length} results from Jackett`);

    // Convert Jackett results to our format
    const results = data.Results.map((item) => {
      // Priority: MagnetUri > Guid (if magnet) > Link (Jackett proxy)
      let magnet = item.MagnetUri;

      // If no magnet, check if Guid is a magnet link
      if (!magnet && item.Guid && item.Guid.startsWith("magnet:")) {
        magnet = item.Guid;
      }

      // If still no magnet, use Jackett download link (fallback)
      if (!magnet && item.Link) {
        magnet = item.Link;
      }

      return {
        title: item.Title,
        seeders: item.Seeders || 0,
        leechers: item.Peers || 0,
        magnet: magnet,
        size: item.Size,
        date: item.PublishDate,
        indexer: item.Tracker || "Unknown",
      };
    }).filter((item) => item.magnet);

    // First, try to find results that match the title
    // Split title into words and require at least 2 words to match
    const movieWords = title
      .toLowerCase()
      .split(/[\s.]+/)
      .filter((w) => w.length > 2);
    console.log(`🔍 Searching for words: ${movieWords.join(", ")}`);

    const titleMatches = results.filter((t) => {
      const titleLower = t.title.toLowerCase();
      // Require at least 2 significant words from movie title to match
      const matchCount = movieWords.filter((word) =>
        titleLower.includes(word),
      ).length;
      const hasMatch = matchCount >= Math.min(2, movieWords.length);

      if (hasMatch) {
        console.log(
          `✅ MATCH: ${t.title} (matched ${matchCount}/${movieWords.length} words)`,
        );
      }

      return hasMatch;
    });

    if (titleMatches.length > 0) {
      console.log(
        `🎯 Found ${titleMatches.length} results matching "${title}"`,
      );
      console.log(`📋 Top match: ${titleMatches[0].title}`);
      
      // For TV shows with season/episode, filter by those specifically
      if (mediaType === 'tv' && seasonEpi) {
        // Extract season and episode numbers from seasonEpi (e.g., "S01E05")
        const epStr = seasonEpi.replace(/S(\d+)E(\d+)/, `S0?$1E0?$2`);
        const epPattern = new RegExp(`${epStr}|${seasonEpi}`, 'i');
        const rangePattern = new RegExp(`(?:${epStr}|${seasonEpi})\\s*(?:-|~)\\s*(?:S\\d+)?(?:E)?\\d{1,3}\\b`, 'i');
        
        const epMatches = titleMatches.filter(t => epPattern.test(t.title) && !rangePattern.test(t.title));
        
        if (epMatches.length > 0) {
          console.log(`✅ Filtered to ${epMatches.length} results matching ${seasonEpi}`);
          // Sort by file size (largest first), then by seeders
          epMatches.sort((a, b) => {
            const sizeA = a.size || 0;
            const sizeB = b.size || 0;
            if (sizeB !== sizeA) return sizeB - sizeA;
            return b.seeders - a.seeders;
          });
          return epMatches.slice(0, 50);
        }
      }
      
      // Sort by file size (largest first), then by seeders
      titleMatches.sort((a, b) => {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        if (sizeB !== sizeA) return sizeB - sizeA;
        return b.seeders - a.seeders;
      });
      return titleMatches.slice(0, 50);
    }

    console.log(`⚠️  No results found matching "${title}"`);
    console.log(`🔍 Words searched: ${movieWords.join(", ")}`);
    console.log(`📊 First 5 results from Jackett:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title} (${r.seeders} seeders)`);
    });

    console.log(
      `⚠️  No results found matching "${title}", falling back to top results`,
    );

    // Sort by file size (largest first), then by seeders
    return results.slice(0, 50).sort((a, b) => {
      const sizeA = a.size || 0;
      const sizeB = b.size || 0;
      if (sizeB !== sizeA) return sizeB - sizeA;
      return b.seeders - a.seeders;
    });
  } catch (error) {
    console.log(
      `⚠️  Jackett error (${error.message}), falling back to mock data`,
    );
    console.log(
      `💡 To use Jackett: Install from https://github.com/Jackett/Jackett`,
    );
    console.log(`   Then configure indexers in http://${CONFIG.jackett_ip}:${CONFIG.jackett_port}`);

    return getMockResults(title);
  }
}

// Convert Jackett proxy link to real magnet link
async function getRealMagnetLink(jackettLink) {
  // If it's already a magnet link, return it
  if (jackettLink.startsWith("magnet:")) {
    return jackettLink;
  }

  // If it's a Jackett proxy URL, fetch the actual torrent info
  if (jackettLink.includes("localhost:9117/dl/")) {
    try {
      console.log(`🔄 Converting Jackett proxy to magnet...`);
      const response = await fetch(jackettLink, {
        method: "GET",
        redirect: "manual", // Don't follow redirect, get the magnet from response
      });

      // Jackett returns the magnet link in the response or redirects to it
      const location = response.headers.get("location");
      if (location && location.startsWith("magnet:")) {
        console.log(`✅ Got real magnet link`);
        return location;
      }

      // If no redirect, try to get from response body
      const text = await response.text();
      const magnetMatch = text.match(/magnet:\?xt=[^"]+/);
      if (magnetMatch) {
        console.log(`✅ Extracted magnet from response`);
        return magnetMatch[0];
      }
    } catch (error) {
      console.log(`⚠️  Could not convert proxy link: ${error.message}`);
    }
  }

  // Return original link as fallback
  return jackettLink;
}

// Mock results as fallback
function getMockResults(movieTitle) {
  const mockResults = [
    {
      title: `${movieTitle} 4K UHD BluRay`,
      seeders: 250,
      leechers: 45,
      magnet: `magnet:?xt=urn:btih:d3ea63c0fe4ba02e74f8c8be4b3b5ef01c04b8c3&dn=${encodeURIComponent(movieTitle)}+4K+UHD&tr=udp://tracker.opentrackr.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce`,
      indexer: `Opentrackr`
    },
    {
      title: `${movieTitle} 4K WEB-DL`,
      seeders: 180,
      leechers: 32,
      magnet: `magnet:?xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0&dn=${encodeURIComponent(movieTitle)}+4K+WEB&tr=udp://tracker.opentrackr.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce`,
      indexer: `Opentrackr`
    },
    {
      title: `${movieTitle} 2160p BluRay`,
      seeders: 320,
      leechers: 58,
      magnet: `magnet:?xt=urn:btih:5f1e9c4b8a7d6c5b4e3f2a1d0c9b8a7f6e5d4c3b&dn=${encodeURIComponent(movieTitle)}+2160p&tr=udp://tracker.opentrackr.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce`,
      indexer: `Internetwarriors`
    },
  ];

  return mockResults;
}

// Status Endpoint - Check Jackett connection
app.get("/api/status", async (req, res) => {
  console.log("🔍 Status endpoint called");
  const status = {
    backend: "✅ Running",
    jackett: "❓ Unknown",
    config: {
      tmdb_api_key: CONFIG.tmdb_api_key ? "✅ Configured" : "⚠️  Not configured",
      jackett_api_key: CONFIG.jackett_api_key ? "✅ Configured" : "⚠️  Not configured",
      jackett_ip: CONFIG.jackett_ip || "localhost",
      jackett_port: CONFIG.jackett_port || 9117,
    },
  };

  // Test Jackett connection
  try {
    console.log(`🔍 Testing Jackett connection...`);
    if (!CONFIG.jackett_api_key) {
      status.jackett = "⚠️  API key not configured";
    } else {
      console.log(
        `🔑 Using API key: ${CONFIG.jackett_api_key.substring(0, 8)}...`,
      );

      // Use Torznab API for testing (returns 200 if working)
      const response = await fetch(
        `http://${CONFIG.jackett_ip}:${CONFIG.jackett_port}/api/v2.0/indexers/all/results/torznab/api?t=search&q=test&apikey=${CONFIG.jackett_api_key}&format=json`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );

      if (response.ok) {
        console.log(`✅ Jackett connected successfully`);
        status.jackett = `✅ Connected`;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    }
  } catch (error) {
    console.log(`❌ Jackett connection failed: ${error.message}`);
    status.jackett = `❌ Not running or unreachable`;
  }

  res.json(status);
});

// Configuration Endpoint - Set all configuration parameters
app.post("/api/config", (req, res) => {
  const { 
    tmdb_api_key, 
    jackett_api_key, 
    jackett_ip, 
    jackett_port,
    backend_url
  } = req.body;

  // Update config with provided values
  if (tmdb_api_key) CONFIG.tmdb_api_key = tmdb_api_key;
  if (jackett_api_key) CONFIG.jackett_api_key = jackett_api_key;
  if (jackett_ip) CONFIG.jackett_ip = jackett_ip;
  if (jackett_port) CONFIG.jackett_port = jackett_port;
  if (backend_url) CONFIG.backend_url = backend_url;

  // Save configuration to file
  saveConfig();

  res.json({
    success: true,
    message: "✅ Configuration updated and saved",
    config: {
      tmdb_api_key: CONFIG.tmdb_api_key ? "***configured***" : "Not set",
      jackett_api_key: CONFIG.jackett_api_key ? "***configured***" : "Not set",
      jackett_ip: CONFIG.jackett_ip,
      jackett_port: CONFIG.jackett_port,
    },
  });
});

// Search Endpoint - Detailed Torrents list
app.post("/api/search", async (req, res) => {
  const { title, type, seasonEpi } = req.body;
  const searchTitle = title || req.body.movieTitle;

  if (!searchTitle) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    const mediaType = type || 'movie';
    const results = await searchTorrentMagnetLinks(searchTitle, mediaType, seasonEpi || '');
    res.json({
      success: true,
      results: results.map((r) => ({
        title: r.title,
        seeders: r.seeders,
        leechers: r.leechers,
        magnet: r.magnet,
        size: r.size || 0,
        indexer: r.indexer
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stream Endpoint
const activeStreams = new Map();

app.get("/api/stream", async (req, res) => {
  const { magnet } = req.query;
  if (!magnet) {
    return res.status(400).send("No magnet provided");
  }

  let engine = activeStreams.get(magnet);
  if (!engine) {
    const torrentOpts = {
      connections: 500, // Max amount of peers to be connected to
      uploads: 10,      // Limit uploads to preserve download bandwidth
      dht: true,        // Whether or not to use DHT to initialize the swarm
      tracker: true,
      trackers: [
        'udp://tracker.opentrackr.org:6969/announce',
        'udp://tracker.internetwarriors.net:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
        'udp://tracker.zer0day.to:1337/announce',
        'udp://tracker.leechers-paradise.org:6969/announce',
        'udp://explodie.org:6969/announce',
        'udp://tracker.coppersurfer.tk:6969/announce'
      ]
    };
    engine = torrentStream(magnet, torrentOpts);
    activeStreams.set(magnet, engine);

    engine.on('ready', () => {
      console.log(`🎬 Engine ready`);
    });
  }

  if (!engine.torrent) {
    await new Promise(resolve => engine.on('ready', resolve));
  }

  const file = engine.files.reduce((a, b) => a.length > b.length ? a : b);
  file.select(); // Prioritize this file's pieces

  const range = req.headers.range;
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
      "Content-Type": "video/mp4",
    });

    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
    stream.on("error", (err) => console.log("Stream err:", err));
  } else {
    res.writeHead(200, {
      "Content-Length": file.length,
      "Content-Type": "video/mp4",
    });

    const stream = file.createReadStream();
    stream.pipe(res);
  }
});

// Stream Stats Endpoint
app.get("/api/stream/stats", (req, res) => {
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

// Test Jackett Connection Endpoint
app.post("/api/test-jackett", async (req, res) => {
  const { jackett_ip, jackett_port, jackett_api_key } = req.body;

  if (!jackett_ip || !jackett_port || !jackett_api_key) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing Jackett configuration" 
    });
  }

  try {
    const url = `http://${jackett_ip}:${jackett_port}/api/v2.0/indexers/all/results/torznab/api?t=search&q=test&apikey=${jackett_api_key}&format=json`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      res.json({ 
        success: true, 
        message: "✅ Jackett connection successful!" 
      });
    } else {
      res.status(response.status).json({ 
        success: false, 
        error: `Jackett returned HTTP ${response.status}` 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: `Cannot connect to Jackett: ${error.message}` 
    });
  }
});

// Start Server
const serverPort = 7676;
const expressServer = app.listen(serverPort, () => {
  console.log(`\n✅ Backend running on http://localhost:${serverPort}`);
  console.log("\n📝 Available endpoints:");
  console.log("  GET  /api/stream - Stream torrent directly");
  console.log("  POST /api/search - Test search");
  console.log("  GET  /api/status - Check Jackett status");
  console.log("  POST /api/config - Configure all services");
  console.log("\n🚀 SETUP INSTRUCTIONS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`1. Open http://localhost:${serverPort}/setup.html in your browser`);
  console.log("2. Enter your TMDB API key (get from themoviedb.org)");
  console.log("3. Enter Jackett API key and address");
  console.log("4. Test Jackett service connection");
  console.log("6. Click 'Complete Setup' to save configuration");
  console.log("7. You'll be redirected to index.html");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});

// Export server to allow graceful shutdown by Electron
module.exports = expressServer;
