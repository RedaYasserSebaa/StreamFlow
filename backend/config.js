const fs = require("fs");
const path = require("path");

// Configuration and Data Paths
const CONFIG_DIR = process.env.STREAMFLOW_CONFIG_DIR || __dirname;
const USERS_FILE = path.join(CONFIG_DIR, "users.json");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const JWT_SECRET = process.env.JWT_SECRET || "streamflow-super-secret-key-123";

// Load or create configuration
let CONFIG = {
  tmdb_api_key: process.env.TMDB_API_KEY || null,
  jackett_api_key: process.env.JACKETT_API_KEY || null,
  jackett_ip: process.env.JACKETT_IP || "localhost",
  jackett_port: parseInt(process.env.JACKETT_PORT) || 9117,
  backend_url: process.env.BACKEND_URL || "http://localhost:7676",
  movies_path: process.env.MOVIES_PATH || null,
  tv_shows_path: process.env.TV_SHOWS_PATH || null,
  
  // expansion fields
  auto_scan_interval: 24,
  metadata_language: 'en-US',
  accent_color: '#3b82f6',
  glass_intensity: 12,
  autoplay: true,
  seek_interval: 10,
  default_language: 'en',
  min_seeders: 1,
  exclude_keywords: ''
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

// User data
let USERS = [];

// Load users
try {
  if (fs.existsSync(USERS_FILE)) {
    USERS = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    // Ensure all users have a sessions array
    USERS.forEach(u => {
      if (!u.sessions) u.sessions = [];
    });
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

module.exports = {
  CONFIG_DIR,
  USERS_FILE,
  CONFIG_FILE,
  JWT_SECRET,
  CONFIG,
  saveConfig,
  USERS,
  saveUsers,
};
