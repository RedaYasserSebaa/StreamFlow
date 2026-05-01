const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { USERS, saveUsers, JWT_SECRET, QUICK_CODES } = require("../state");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Auth Endpoints
router.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
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

    const sessionId = Math.random().toString(36).substring(2, 15);
    const session = {
      id: sessionId,
      deviceName: req.headers['user-agent'] || 'New Account',
      ip: req.ip,
      lastActive: Date.now()
    };
    if (!newUser.sessions) newUser.sessions = [];
    newUser.sessions.push(session);
    saveUsers();

    const token = jwt.sign({ id: newUser.id, username: newUser.username, sessionId }, JWT_SECRET);
    res.json({ success: true, token, user: { username: newUser.username, config: newUser.config } });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const sessionId = Math.random().toString(36).substring(2, 15);
  const session = {
    id: sessionId,
    deviceName: req.headers['user-agent'] || 'Direct Login',
    ip: req.ip,
    lastActive: Date.now()
  };
  if (!user.sessions) user.sessions = [];
  user.sessions.push(session);
  saveUsers();

  const token = jwt.sign({ id: user.id, username: user.username, sessionId }, JWT_SECRET);
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

router.get("/api/auth/users", (req, res) => {
  const safeUsers = USERS.map(u => ({
    id: u.id,
    username: u.username,
    accent_color: u.config?.accent_color || '#3b82f6',
    avatar: u.config?.avatar
  }));
  res.json({ success: true, users: safeUsers });
});

router.post("/api/auth/login-profile", (req, res) => {
  const id = req.body?.id;
  const user = USERS.find(u => u.id === id);

  if (!user) {
    return res.status(404).json({ error: "User profile not found" });
  }

  const sessionId = Math.random().toString(36).substring(2, 15);
  const session = {
    id: sessionId,
    deviceName: req.headers['user-agent'] || 'Unknown Device',
    ip: req.ip,
    lastActive: Date.now()
  };

  if (!user.sessions) user.sessions = [];
  user.sessions.push(session);
  saveUsers();

  const token = jwt.sign({ id: user.id, username: user.username, sessionId }, JWT_SECRET);
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

router.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
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
router.post("/api/auth/quick-connect/generate", (req, res) => {
  const deviceName = req.body?.deviceName || req.headers['user-agent'];
  // Generate a random 6-character alphanumeric code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 600000; // 10 minutes from now

  QUICK_CODES.set(code, { 
    status: 'pending',
    userId: null,
    token: null,
    user: null,
    deviceName: deviceName || 'Quick Connect Device',
    expiresAt 
  });
  
  res.json({ success: true, code, expiresAt });
});

router.post("/api/auth/quick-connect/authorize", authenticateToken, async (req, res) => {
  const code = req.body?.code;
  if (!code) return res.status(400).json({ error: "Code is required" });

  const data = QUICK_CODES.get(code.toUpperCase());
  if (!data || data.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  const user = USERS.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Authorize the code
  const sessionId = Math.random().toString(36).substring(2, 15);
  const session = {
    id: sessionId,
    deviceName: data.deviceName || 'Quick Connect Device',
    ip: req.ip,
    lastActive: Date.now()
  };

  if (!user.sessions) user.sessions = [];
  user.sessions.push(session);
  saveUsers();

  const token = jwt.sign({ id: user.id, username: user.username, sessionId }, JWT_SECRET);
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

router.get("/api/auth/quick-connect/poll/:code", (req, res) => {
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

router.delete("/api/auth/delete-me", authenticateToken, (req, res) => {
  const userIndex = USERS.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  USERS.splice(userIndex, 1);
  saveUsers();
  res.json({ success: true });
});

module.exports = router;
