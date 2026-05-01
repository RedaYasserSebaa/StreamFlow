const {
  CONFIG,
  saveConfig,
  USERS,
  saveUsers,
  JWT_SECRET,
  CONFIG_DIR,
  USERS_FILE,
  CONFIG_FILE,
} = require("./config");

// In-memory Quick Connect codes (code -> { userId, expiresAt })
const QUICK_CODES = new Map();

// Helper to cleanup expired codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of QUICK_CODES.entries()) {
    if (data.expiresAt < now) QUICK_CODES.delete(code);
  }
}, 60000);

// Active torrent stream engines (magnet -> engine)
const activeStreams = new Map();

// In-memory cache for local media metadata (keyed by userId)
const localMediaCache = new Map();

module.exports = {
  // Re-export from config for convenience
  CONFIG,
  saveConfig,
  USERS,
  saveUsers,
  JWT_SECRET,
  CONFIG_DIR,
  USERS_FILE,
  CONFIG_FILE,
  // State singletons
  QUICK_CODES,
  activeStreams,
  localMediaCache,
};
