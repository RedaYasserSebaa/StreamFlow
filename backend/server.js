#!/usr/bin/env node
const handleCli = require("./cli");
handleCli(); // Exits process if --setup-service flag is present

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// Import route modules
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const mediaRoutes = require("./routes/media");
const streamRoutes = require("./routes/stream");
const systemRoutes = require("./routes/system");

// Import middleware
const cspMiddleware = require("./middleware/csp");

const app = express();

// Global middleware (order matters)
app.use(cors());
app.use(express.json());
app.use(cspMiddleware);

// Mount route modules
app.use(systemRoutes);  // Includes devtools fix, status, config, test-jackett
app.use(authRoutes);    // /api/auth/*
app.use(userRoutes);    // /api/user/*

// Serve static frontend files (must come before media/stream routes for proper fallback)
const distPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(distPath)) {
  console.log("Serving frontend from /frontend/dist");
  app.use(express.static(distPath));
} else {
  console.log("Serving frontend from legacy folder");
  const legacyPath = path.join(__dirname, "../legacy");
  app.use(express.static(legacyPath));
}

app.use(mediaRoutes);   // /api/local, /api/search, /api/browse
app.use(streamRoutes);  // /api/stream, /api/stream/local, /api/stream/stats

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
