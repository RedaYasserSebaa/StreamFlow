#!/usr/bin/env node
const express = require("express");
const cors = require("cors");
const { default: got } = require("got");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const torrentStream = require("torrent-stream");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
// Configuration and Data Paths
const CONFIG_DIR = process.env.STREAMFLOW_CONFIG_DIR || __dirname;
const USERS_FILE = path.join(CONFIG_DIR, "users.json");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

let USERS = [];
const JWT_SECRET = process.env.JWT_SECRET || "streamflow-super-secret-key-123";

// Load users
try {
  if (fs.existsSync(USERS_FILE)) {
    USERS = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    console.log(`Loaded ${USERS.length} users from file`);
  }
} catch (error) {
  console.log("Could not load users file, starting with empty database");
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(USERS, null, 2));
  } catch (error) {
    console.error("Could not save users:", error.message);
  }
}

// In-memory Quick Connect codes (code -> { userId, expiresAt })
const QUICK_CODES = new Map();

// Helper to cleanup expired codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of QUICK_CODES.entries()) {
    if (data.expiresAt < now) QUICK_CODES.delete(code);
  }
}, 60000);

// Load or create configuration
let CONFIG = {
  tmdb_api_key: process.env.TMDB_API_KEY || null,
  jackett_api_key: process.env.JACKETT_API_KEY || null,
  jackett_ip: process.env.JACKETT_IP || "localhost",
  jackett_port: process.env.JACKETT_PORT || 9117,
  backend_url: process.env.BACKEND_URL || "http://localhost:7676",
  movies_path: process.env.MOVIES_PATH || null,
  tv_shows_path: process.env.TV_SHOWS_PATH || null,
};

// Load saved configuration
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    CONFIG = { ...CONFIG, ...savedConfig };
    console.log("Loaded configuration from file");
  }
} catch (error) {
  console.log("Could not load config file, using defaults");
}

// Save configuration function
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2));
    console.log("Configuration saved");
  } catch (error) {
    console.error("Could not save config:", error.message);
  }
}

// Local Media Utilities
function parseLocalFilename(filename) {
  // Remove extension and common separators
  const cleanName = filename
    .replace(/\.(mp4|mkv|avi|mov|webm|m4v|ts|flv)$/i, "")
    .replace(/[._\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Try TV show pattern S01E01 or 1x01
  const tvMatch = cleanName.match(/(.+?)\s*S(\d+)\s*E(\d+)/i) || cleanName.match(/(.+?)\s*(\d+)x(\d+)/i);
  if (tvMatch) {
    return {
      type: "tv",
      title: tvMatch[1].trim(),
      season: parseInt(tvMatch[2]),
      episode: parseInt(tvMatch[3])
    };
  }

  // Try Movie pattern (Year)
  const movieMatch = cleanName.match(/(.+?)\s*\(?((?:19|20)\d{2})\)?/i);
  if (movieMatch) {
    return {
      type: "movie",
      title: movieMatch[1].trim(),
      year: parseInt(movieMatch[2])
    };
  }

  return { type: "unknown", title: cleanName };
}

// In-memory cache for local media metadata (keyed by userId)
const localMediaCache = new Map();

async function scanDirectory(dir, type) {
  let results = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(await scanDirectory(fullPath, type));
      } else if (entry.isFile() && /\.(mp4|mkv|avi|mov|webm|m4v|ts|flv)$/i.test(entry.name)) {
        const parsed = parseLocalFilename(entry.name);
        results.push({
          ...parsed,
          type: type || parsed.type,
          filename: entry.name,
          localPath: fullPath,
          size: (await fs.promises.stat(fullPath)).size
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err.message);
  }
  return results;
}

async function enrichWithTMDB(items) {
  if (!CONFIG.tmdb_api_key) return items;

  const enriched = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const searchType = item.type === "tv" ? "tv" : "movie";
      const yearParam = item.type === "tv" ? "first_air_date_year" : "primary_release_year";
      
      const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${CONFIG.tmdb_api_key}&query=${encodeURIComponent(item.title)}${item.year ? `&${yearParam}=${item.year}` : ""}`;
      
      const response = await got(url).json();
      const match = response.results && response.results[0];

      if (match) {
        enriched.push({
          ...item,
          id: match.id,
          title: match.title || match.name,
          name: match.name,
          overview: match.overview,
          poster_path: match.poster_path,
          backdrop_path: match.backdrop_path,
          vote_average: match.vote_average,
          release_date: match.release_date || match.first_air_date,
          media_type: item.type,
          isLocal: true,
          localId: `local_${match.id}_${Buffer.from(item.localPath).toString('base64').slice(-8)}`
        });
      } else {
        enriched.push({ 
          ...item, 
          isLocal: true, 
          localId: `local_${Buffer.from(item.localPath).toString('base64').slice(-12)}` 
        });
      }
      
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      console.error(`TMDB enrichment failed for ${item.title}:`, err.message);
      enriched.push({ ...item, isLocal: true });
    }
  }
  return enriched;
}

function findMediaFiles(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      findMediaFiles(res, files);
    } else if (/\.(mp4|mkv|avi|mov|webm)$/i.test(entry.name)) {
      files.push({
        name: entry.name,
        path: res,
        size: fs.statSync(res).size
      });
    }
  }
  return files;
}

function findLocalMatch(searchTitle, type, season = null, episode = null, year = null) {
  const rootDir = type === "movie" ? CONFIG.movies_path : CONFIG.tv_shows_path;
  if (!rootDir || !fs.existsSync(rootDir)) return null;

  const allFiles = findMediaFiles(rootDir);
  const normalizedSearch = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const file of allFiles) {
    const fileName = file.name;
    const folderName = path.basename(path.dirname(file.path));
    
    // Parse both filename and folder name
    const fileInfo = parseLocalFilename(fileName);
    const folderInfo = parseLocalFilename(folderName);

    // Combine info: prioritize filename info but fallback to folder info
    const info = fileInfo.type !== "unknown" ? fileInfo : folderInfo;
    
    // Check if the type matches
    if (info.type !== "unknown" && info.type !== type) continue;

    const normalizedFileInfoTitle = info.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedFolderName = folderName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedFileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Title match logic
    const isTitleMatch = (
      normalizedSearch.includes(normalizedFileInfoTitle) || 
      normalizedFileInfoTitle.includes(normalizedSearch) ||
      normalizedFolderName.includes(normalizedSearch) ||
      normalizedFileName.includes(normalizedSearch)
    );

    if (isTitleMatch) {
      if (type === "tv") {
        // For TV, we MUST match season and episode
        // Check if SxxExx is in the filename or foldername if info failed
        const epStr = `s${season?.toString().padStart(2, "0")}e${episode?.toString().padStart(2, "0")}`;
        const hasEpMatch = (
          (info.season === parseInt(season) && info.episode === parseInt(episode)) ||
          normalizedFileName.includes(epStr) ||
          normalizedFolderName.includes(epStr)
        );
        if (hasEpMatch) return file;
      } else {
        // For movies, if we have a year, try to confirm it
        if (year && (info.year || folderInfo.year)) {
          const matchedYear = info.year || folderInfo.year;
          if (matchedYear === parseInt(year)) return file;
        } else {
          // If no year specified or found, just trust the title match
          return file;
        }
      }
    }
  }
  return null;
}
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

// Routes for Local Media - Secure with authenticateToken
app.get("/api/local", authenticateToken, async (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();
  const cacheKey = user.id;
  const userCache = localMediaCache.get(cacheKey) || { data: [], lastScan: 0 };
  
  if (!forceRefresh && userCache.data.length > 0 && (now - userCache.lastScan) < 300000) {
    return res.json({ success: true, results: userCache.data, cached: true });
  }

  const moviesDir = user.config?.movies_path;
  const tvDir = user.config?.tv_shows_path;

  let allFiles = [];
  if (moviesDir) allFiles = allFiles.concat(await scanDirectory(moviesDir, "movie"));
  if (tvDir) allFiles = allFiles.concat(await scanDirectory(tvDir, "tv"));

  const enrichedData = await enrichWithTMDB(allFiles);
  
  // Deduplicate TV Shows for the library view
  const groupedResults = [];
  const tvMap = new Map();

  for (const item of enrichedData) {
    if (item.media_type === 'movie') {
      groupedResults.push(item);
    } else {
      // Group by ID if available, otherwise by title
      const showKey = item.id ? `tmdb_${item.id}` : `title_${item.title.toLowerCase().trim()}`;
      if (!tvMap.has(showKey)) {
        tvMap.set(showKey, { 
          ...item, 
          isGrouped: true,
          episodesFound: 1 
        });
      } else {
        const existing = tvMap.get(showKey);
        existing.episodesFound++;
      }
    }
  }

  const finalResults = [...groupedResults, ...Array.from(tvMap.values())];
  
  localMediaCache.set(cacheKey, {
    data: finalResults,
    lastScan: now
  });

  res.json({ success: true, results: finalResults });
});

// Auth Endpoints
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  if (USERS.find(u => u.username === username)) {
    return res.status(400).json({ error: "User already exists" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      config: null,
      userLists: {},
      continueWatching: []
    };
    USERS.push(newUser);
    saveUsers();

    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET);
    res.json({ success: true, token, user: { username: newUser.username, config: newUser.config } });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ 
    success: true, 
    token, 
    user: { 
      username: user.username, 
      config: user.config,
      userLists: user.userLists,
      continueWatching: user.continueWatching
    } 
  });
});

app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Missing fields" });

  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return res.status(400).json({ error: "Incorrect current password" });

  try {
    user.password = await bcrypt.hash(newPassword, 10);
    saveUsers();
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Quick Connect Endpoints
app.post("/api/auth/quick-connect/generate", (req, res) => {
  // Generate a random 6-character alphanumeric code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 600000; // 10 minutes from now

  QUICK_CODES.set(code, { 
    status: 'pending',
    userId: null,
    token: null,
    user: null,
    expiresAt 
  });
  
  res.json({ success: true, code, expiresAt });
});

app.post("/api/auth/quick-connect/authorize", authenticateToken, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });

  const data = QUICK_CODES.get(code.toUpperCase());
  if (!data || data.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Authorize the code
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  QUICK_CODES.set(code.toUpperCase(), {
    ...data,
    status: 'authorized',
    userId: user.id,
    token,
    user: {
      username: user.username,
      config: user.config,
      userLists: user.userLists,
      continueWatching: user.continueWatching
    }
  });

  res.json({ success: true, message: "Device authorized successfully" });
});

app.get("/api/auth/quick-connect/poll/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const data = QUICK_CODES.get(code);

  if (!data || data.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  if (data.status === 'authorized') {
    // Cleanup after successful poll
    QUICK_CODES.delete(code);
    return res.json({ 
      success: true, 
      status: 'authorized',
      token: data.token,
      user: data.user
    });
  }

  res.json({ success: true, status: 'pending' });
});

app.delete("/api/auth/delete-me", authenticateToken, (req, res) => {
  const userIndex = USERS.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  USERS.splice(userIndex, 1);
  saveUsers();
  res.json({ success: true });
});

// User Data Sync Endpoints
app.get("/api/user/data", authenticateToken, (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  res.json({
    config: user.config,
    userLists: user.userLists,
    continueWatching: user.continueWatching
  });
});

app.post("/api/user/data", authenticateToken, (req, res) => {
  const userIndex = USERS.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  const { config, userLists, continueWatching } = req.body;
  
  if (config !== undefined) USERS[userIndex].config = config;
  if (userLists !== undefined) USERS[userIndex].userLists = userLists;
  if (continueWatching !== undefined) USERS[userIndex].continueWatching = continueWatching;

  saveUsers();
  res.json({ success: true });
});

// Serve static frontend files
const distPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(distPath)) {
  console.log("Serving frontend from /frontend/dist");
  app.use(express.static(distPath));
} else {
  console.log("Serving frontend from legacy folder");
  const legacyPath = path.join(__dirname, "../legacy");
  app.use(express.static(legacyPath));
}

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

    console.log(`Querying Jackett: ${searchQuery} (Type: ${mediaType}, Cat: ${categories})`);

    const jacketUrl = `${JACKETT_URL}/api/v2.0/indexers/all/results`;
    const searchUrl = `${jacketUrl}?apikey=${JACKETT_API_KEY}&Query=${encodeURIComponent(searchQuery)}&Category=${categories}`;
    console.log(`Jackett URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.Results || data.Results.length === 0) {
      console.log(`No results from Jackett, using mock data`);
      return getMockResults(title);
    }

    console.log(`Found ${data.Results.length} results from Jackett`);

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
    console.log(`Searching for words: ${movieWords.join(", ")}`);

    const titleMatches = results.filter((t) => {
      const titleLower = t.title.toLowerCase();
      // Require at least 2 significant words from movie title to match
      const matchCount = movieWords.filter((word) =>
        titleLower.includes(word),
      ).length;
      const hasMatch = matchCount >= Math.min(2, movieWords.length);

      if (hasMatch) {
        console.log(
          `MATCH: ${t.title} (matched ${matchCount}/${movieWords.length} words)`,
        );
      }

      return hasMatch;
    });

    if (titleMatches.length > 0) {
      console.log(
        `Found ${titleMatches.length} results matching "${title}"`,
      );
      console.log(`Top match: ${titleMatches[0].title}`);
      
      // For TV shows with season/episode, filter by those specifically
      if (mediaType === 'tv' && seasonEpi) {
        // Extract season and episode numbers from seasonEpi (e.g., "S01E05")
        const epStr = seasonEpi.replace(/S(\d+)E(\d+)/, `S0?$1E0?$2`);
        const epPattern = new RegExp(`${epStr}|${seasonEpi}`, 'i');
        const rangePattern = new RegExp(`(?:${epStr}|${seasonEpi})\\s*(?:-|~)\\s*(?:S\\d+)?(?:E)?\\d{1,3}\\b`, 'i');
        
        const epMatches = titleMatches.filter(t => epPattern.test(t.title) && !rangePattern.test(t.title));
        
        if (epMatches.length > 0) {
          console.log(`Filtered to ${epMatches.length} results matching ${seasonEpi}`);
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

    console.log(`  No results found matching "${title}"`);
    console.log(`Words searched: ${movieWords.join(", ")}`);
    console.log(`First 5 results from Jackett:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title} (${r.seeders} seeders)`);
    });

    console.log(
      `  No results found matching "${title}", falling back to top results`,
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
      `  Jackett error (${error.message}), falling back to mock data`,
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
      console.log(`Converting Jackett proxy to magnet...`);
      const response = await fetch(jackettLink, {
        method: "GET",
        redirect: "manual", // Don't follow redirect, get the magnet from response
      });

      // Jackett returns the magnet link in the response or redirects to it
      const location = response.headers.get("location");
      if (location && location.startsWith("magnet:")) {
        console.log(`Got real magnet link`);
        return location;
      }

      // If no redirect, try to get from response body
      const text = await response.text();
      const magnetMatch = text.match(/magnet:\?xt=[^"]+/);
      if (magnetMatch) {
        console.log(`Extracted magnet from response`);
        return magnetMatch[0];
      }
    } catch (error) {
      console.log(`  Could not convert proxy link: ${error.message}`);
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
  console.log("Status endpoint called");
  const status = {
    backend: "Running",
    jackett: "Unknown",
    config: {
      tmdb_api_key: CONFIG.tmdb_api_key ? "Configured" : "  Not configured",
      jackett_api_key: CONFIG.jackett_api_key ? "Configured" : "  Not configured",
      jackett_ip: CONFIG.jackett_ip || "localhost",
      jackett_port: CONFIG.jackett_port || 9117,
    },
  };

  // Test Jackett connection
  try {
    console.log(`Testing Jackett connection...`);
    if (!CONFIG.jackett_api_key) {
      status.jackett = "  API key not configured";
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
        console.log(`Jackett connected successfully`);
        status.jackett = `Connected`;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    }
  } catch (error) {
    console.log(`Jackett connection failed: ${error.message}`);
    status.jackett = `Not running or unreachable`;
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
    backend_url,
    movies_path,
    tv_shows_path
  } = req.body;

  // Update config with provided values
  if (tmdb_api_key) CONFIG.tmdb_api_key = tmdb_api_key;
  if (jackett_api_key) CONFIG.jackett_api_key = jackett_api_key;
  if (jackett_ip) CONFIG.jackett_ip = jackett_ip;
  if (jackett_port) CONFIG.jackett_port = jackett_port;
  if (backend_url) CONFIG.backend_url = backend_url;
  if (movies_path !== undefined) CONFIG.movies_path = movies_path;
  if (tv_shows_path !== undefined) CONFIG.tv_shows_path = tv_shows_path;
  if (req.body.hasOwnProperty('setup_complete')) CONFIG.setup_complete = req.body.setup_complete;

  // Save configuration to file
  saveConfig();

  res.json({
    success: true,
    message: "Configuration updated and saved",
    config: {
      tmdb_api_key: CONFIG.tmdb_api_key ? "***configured***" : "Not set",
      jackett_api_key: CONFIG.jackett_api_key ? "***configured***" : "Not set",
      jackett_ip: CONFIG.jackett_ip,
      jackett_port: CONFIG.jackett_port,
      movies_path: CONFIG.movies_path,
      tv_shows_path: CONFIG.tv_shows_path,
      setup_complete: CONFIG.setup_complete,
    },
  });
});

// Search Endpoint - Detailed Torrents list
app.post("/api/search", async (req, res) => {
  const { title, type, seasonEpi, year } = req.body;
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const searchTitle = title || req.body.movieTitle;

  if (!searchTitle) {
    return res.status(400).json({ error: "Title is required" });
  }

  // Look for a local match first
  let localFile = null;
  try {
    let season = null;
    let episode = null;
    if (mediaType === 'tv' && seasonEpi) {
      const match = seasonEpi.match(/S(\d+)E(\d+)/i);
      if (match) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
      }
    }
    localFile = findLocalMatch(searchTitle, mediaType, season, episode, year);
  } catch (e) {
    console.error("Error finding local match:", e);
  }

  try {
    const results = await searchTorrentMagnetLinks(searchTitle, mediaType, seasonEpi || '');
    
    const mappedResults = results.map((r) => ({
      title: r.title,
      seeders: r.seeders,
      leechers: r.leechers,
      magnet: r.magnet,
      size: r.size || 0,
      indexer: r.indexer
    }));

    if (localFile) {
      mappedResults.unshift({
        title: `[LOCAL] ${localFile.name}`,
        seeders: 9999,
        leechers: 0,
        magnet: `local://${localFile.path}`,
        size: localFile.size,
        indexer: "Local Storage",
        isLocal: true
      });
    }

    res.json({
      success: true,
      results: mappedResults,
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
      console.log(`Engine ready`);
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

// Local Stream Endpoint
app.get("/api/stream/local", (req, res) => {
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

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
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
        message: "Jackett connection successful!" 
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
  console.log(`\nBackend running on http://localhost:${serverPort}`);
  console.log("\nAvailable endpoints:");
  console.log("  GET  /api/stream - Stream torrent directly");
  console.log("  POST /api/search - Test search");
  console.log("  GET  /api/status - Check Jackett status");
  console.log("  POST /api/config - Configure all services");
  console.log("\nSETUP INSTRUCTIONS:");
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
