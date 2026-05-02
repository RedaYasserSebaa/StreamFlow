// Content Security Policy (CSP) Middleware
function cspMiddleware(req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' http://localhost:7676 http://127.0.0.1:7676; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plyr.io; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.plyr.io https://fonts.googleapis.com; " +
    "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://image.tmdb.org https://api.themoviedb.org https://*.tile.openstreetmap.org; " +
    "media-src 'self' blob: http://localhost:7676 http://127.0.0.1:7676 https://cdn.plyr.io; " +
    "connect-src 'self' http://localhost:7676 http://127.0.0.1:7676 ws://localhost:7676 https://api.themoviedb.org https://*.themoviedb.org https://cdn.plyr.io;"
  );
  next();
}

module.exports = cspMiddleware;
