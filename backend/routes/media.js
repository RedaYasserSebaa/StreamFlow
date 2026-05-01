const express = require("express");
const fs = require("fs");
const path = require("path");
const { USERS, CONFIG, localMediaCache } = require("../state");
const authenticateToken = require("../middleware/auth");
const { scanDirectory, enrichWithTMDB, findLocalMatch } = require("../services/localMedia");
const { searchTorrentMagnetLinks } = require("../services/jackett");

const router = express.Router();

// Routes for Local Media - Secure with authenticateToken
router.get("/api/local", authenticateToken, async (req, res) => {
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

// Search Endpoint - Detailed Torrents list (Secured)
router.post("/api/search", authenticateToken, async (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  const userConfig = user?.config || CONFIG;
  
  const { title, type, seasonEpi, year } = req.body || {};
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const movieTitle = req.body?.movieTitle;
  const searchTitle = title || movieTitle;

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
    const results = await searchTorrentMagnetLinks(searchTitle, mediaType, seasonEpi || '', userConfig);
    
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

// Directory Browser Endpoint - Browse server directories for path selection
router.get("/api/browse", authenticateToken, (req, res) => {
  const requestedPath = req.query.path;

  try {
    let browsePath;

    if (!requestedPath) {
      // Default: return OS root(s)
      if (process.platform === 'win32') {
        // List available drive letters on Windows
        const drives = [];
        for (let i = 65; i <= 90; i++) {
          const drive = String.fromCharCode(i) + ':\\';
          try {
            fs.accessSync(drive, fs.constants.R_OK);
            drives.push({ name: drive, path: drive });
          } catch {}
        }
        return res.json({ current: '', parent: null, directories: drives });
      }
      browsePath = '/';
    } else {
      browsePath = path.resolve(requestedPath);
    }

    if (!fs.existsSync(browsePath)) {
      return res.status(404).json({ error: "Path not found" });
    }
    if (!fs.statSync(browsePath).isDirectory()) {
      return res.status(400).json({ error: "Path is not a directory" });
    }

    const entries = fs.readdirSync(browsePath, { withFileTypes: true });
    const directories = entries
      .filter(e => {
        if (!e.isDirectory()) return false;
        // Skip hidden directories
        if (e.name.startsWith('.')) return false;
        // Check readability
        try {
          fs.accessSync(path.join(browsePath, e.name), fs.constants.R_OK);
          return true;
        } catch {
          return false;
        }
      })
      .map(e => ({ name: e.name, path: path.join(browsePath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(browsePath);
    res.json({
      current: browsePath,
      parent: parentPath !== browsePath ? parentPath : null,
      directories
    });
  } catch (err) {
    res.status(500).json({ error: "Could not browse directory" });
  }
});

module.exports = router;
