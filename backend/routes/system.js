const express = require("express");
const { CONFIG, saveConfig } = require("../state");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Fix for Chrome DevTools discovery warning/error
router.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({}));
});

// Status Endpoint - Check Jackett connection
router.get("/api/status", async (req, res) => {
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
router.post("/api/config", (req, res) => {
  const { 
    tmdb_api_key, 
    jackett_api_key, 
    jackett_ip, 
    jackett_port,
    backend_url
  } = req.body || {};

  // Update config with provided values
  if (tmdb_api_key) CONFIG.tmdb_api_key = tmdb_api_key;
  if (jackett_api_key) CONFIG.jackett_api_key = jackett_api_key;
  if (jackett_ip) CONFIG.jackett_ip = jackett_ip;
  if (jackett_port) CONFIG.jackett_port = jackett_port;
  if (backend_url) CONFIG.backend_url = backend_url;
  
  // expansion fields
  const body = req.body || {};
  if (body.metadata_language) CONFIG.metadata_language = body.metadata_language;
  if (body.accent_color) CONFIG.accent_color = body.accent_color;
  if (body.glass_intensity !== undefined) CONFIG.glass_intensity = body.glass_intensity;
  if (body.autoplay !== undefined) CONFIG.autoplay = body.autoplay;
  if (body.seek_interval !== undefined) CONFIG.seek_interval = body.seek_interval;
  if (body.default_language) CONFIG.default_language = body.default_language;
  if (body.min_seeders !== undefined) CONFIG.min_seeders = body.min_seeders;
  if (body.exclude_keywords !== undefined) CONFIG.exclude_keywords = body.exclude_keywords;

  if (body.hasOwnProperty('setup_complete')) CONFIG.setup_complete = body.setup_complete;

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
      setup_complete: CONFIG.setup_complete,
    },
  });
});

// Test Jackett Connection Endpoint
router.post("/api/test-jackett", async (req, res) => {
  const { jackett_ip, jackett_port, jackett_api_key } = req.body || {};

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

module.exports = router;
