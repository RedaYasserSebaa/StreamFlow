const express = require("express");
const { USERS, saveUsers } = require("../state");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Device Session Management
router.get("/api/user/sessions", authenticateToken, (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  res.json({ success: true, sessions: user.sessions || [] });
});

router.delete("/api/user/sessions/:sessionId", authenticateToken, (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.sessions = (user.sessions || []).filter(s => s.id !== req.params.sessionId);
  saveUsers();
  
  res.json({ success: true, message: "Session revoked" });
});

// User Data Sync Endpoints
router.get("/api/user/data", authenticateToken, (req, res) => {
  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  res.json({
    config: user.config,
    userLists: user.userLists,
    continueWatching: user.continueWatching
  });
});

router.post("/api/user/data", authenticateToken, (req, res) => {
  const userIndex = USERS.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  const { config, userLists, continueWatching } = req.body || {};
  
  if (config !== undefined) USERS[userIndex].config = config;
  if (userLists !== undefined) USERS[userIndex].userLists = userLists;
  if (continueWatching !== undefined) USERS[userIndex].continueWatching = continueWatching;

  saveUsers();
  res.json({ success: true });
});

module.exports = router;
