const express = require("express");
const { USERS, CONFIG } = require("../state");
const authenticateToken = require("../middleware/auth");
const { searchTorrentMagnetLinks } = require("../services/jackett");

const router = express.Router();



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

    res.json({
      success: true,
      results: mappedResults,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;
