const jwt = require("jsonwebtoken");
const { USERS, JWT_SECRET } = require("../state");

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // Also check query parameter for video players that don't support headers
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    
    const user = USERS.find(u => u.id === decodedUser.id);
    if (!user) {
      return res.status(401).json({ error: "User session invalid or deleted" });
    }

    // Verify session integrity
    const isValidSession = decodedUser.sessionId && user.sessions.some(s => s.id === decodedUser.sessionId);
    
    if (!isValidSession) {
      return res.status(401).json({ error: "Session revoked, expired, or legacy token. Please log in again." });
    }
    
    req.user = decodedUser;
    next();
  });
};

module.exports = authenticateToken;
