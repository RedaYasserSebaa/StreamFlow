const path = require("path");

/**
 * Get the MIME content type for a video file extension.
 * @param {string} filePath - File path or extension (e.g., ".mkv" or "/path/to/file.mkv")
 * @returns {string} MIME type string
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mkv') return 'video/x-matroska';
  if (ext === '.avi') return 'video/x-msvideo';
  return 'video/mp4';
}

module.exports = { getContentType };
