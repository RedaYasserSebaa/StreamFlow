const fs = require("fs");
const path = require("path");
const { default: got } = require("got");
const { CONFIG } = require("../state");

// Local Media Utilities

function parseLocalFilename(filename) {
  // Remove extension and common separators
  const cleanName = filename
    .replace(/\.(mp4|mkv|avi|mov|webm|m4v|ts|flv)$/i, "")
    .replace(/[._\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Try TV show pattern S01E01 or 1x01
  const tvMatch = cleanName.match(/(.+?)\s*S(\d+)\s*E(\d+)/i) || cleanName.match(/(.+?)\s*(\d+)x(\d+)/i);
  if (tvMatch) {
    return {
      type: "tv",
      title: tvMatch[1].trim(),
      season: parseInt(tvMatch[2]),
      episode: parseInt(tvMatch[3])
    };
  }

  // Try Movie pattern (Year)
  const movieMatch = cleanName.match(/(.+?)\s*\(?((?:19|20)\d{2})\)?/i);
  if (movieMatch) {
    return {
      type: "movie",
      title: movieMatch[1].trim(),
      year: parseInt(movieMatch[2])
    };
  }

  return { type: "unknown", title: cleanName };
}

async function scanDirectory(dir, type) {
  let results = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(await scanDirectory(fullPath, type));
      } else if (entry.isFile() && /\.(mp4|mkv|avi|mov|webm|m4v|ts|flv)$/i.test(entry.name)) {
        const parsed = parseLocalFilename(entry.name);
        results.push({
          ...parsed,
          type: type || parsed.type,
          filename: entry.name,
          localPath: fullPath,
          size: (await fs.promises.stat(fullPath)).size
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err.message);
  }
  return results;
}

async function enrichWithTMDB(items) {
  if (!CONFIG.tmdb_api_key) return items;

  const enriched = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const searchType = item.type === "tv" ? "tv" : "movie";
      const yearParam = item.type === "tv" ? "first_air_date_year" : "primary_release_year";
      
      const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${CONFIG.tmdb_api_key}&query=${encodeURIComponent(item.title)}${item.year ? `&${yearParam}=${item.year}` : ""}`;
      
      const response = await got(url).json();
      const match = response.results && response.results[0];

      if (match) {
        enriched.push({
          ...item,
          id: match.id,
          title: match.title || match.name,
          name: match.name,
          overview: match.overview,
          poster_path: match.poster_path,
          backdrop_path: match.backdrop_path,
          vote_average: match.vote_average,
          release_date: match.release_date || match.first_air_date,
          media_type: item.type,
          isLocal: true,
          localId: `local_${match.id}_${Buffer.from(item.localPath).toString('base64').slice(-8)}`
        });
      } else {
        enriched.push({ 
          ...item, 
          isLocal: true, 
          localId: `local_${Buffer.from(item.localPath).toString('base64').slice(-12)}` 
        });
      }
      
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      console.error(`TMDB enrichment failed for ${item.title}:`, err.message);
      enriched.push({ ...item, isLocal: true });
    }
  }
  return enriched;
}

function findMediaFiles(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      findMediaFiles(res, files);
    } else if (/\.(mp4|mkv|avi|mov|webm)$/i.test(entry.name)) {
      files.push({
        name: entry.name,
        path: res,
        size: fs.statSync(res).size
      });
    }
  }
  return files;
}

function findLocalMatch(searchTitle, type, season = null, episode = null, year = null) {
  const rootDir = type === "movie" ? CONFIG.movies_path : CONFIG.tv_shows_path;
  if (!rootDir || !fs.existsSync(rootDir)) return null;

  const allFiles = findMediaFiles(rootDir);
  const normalizedSearch = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const file of allFiles) {
    const fileName = file.name;
    const folderName = path.basename(path.dirname(file.path));
    
    // Parse both filename and folder name
    const fileInfo = parseLocalFilename(fileName);
    const folderInfo = parseLocalFilename(folderName);

    // Combine info: prioritize filename info but fallback to folder info
    const info = fileInfo.type !== "unknown" ? fileInfo : folderInfo;
    
    // Check if the type matches
    if (info.type !== "unknown" && info.type !== type) continue;

    const normalizedFileInfoTitle = info.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedFolderName = folderName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedFileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Title match logic
    const isTitleMatch = (
      normalizedSearch.includes(normalizedFileInfoTitle) || 
      normalizedFileInfoTitle.includes(normalizedSearch) ||
      normalizedFolderName.includes(normalizedSearch) ||
      normalizedFileName.includes(normalizedSearch)
    );

    if (isTitleMatch) {
      if (type === "tv") {
        // For TV, we MUST match season and episode
        // Check if SxxExx is in the filename or foldername if info failed
        const epStr = `s${season?.toString().padStart(2, "0")}e${episode?.toString().padStart(2, "0")}`;
        const hasEpMatch = (
          (info.season === parseInt(season) && info.episode === parseInt(episode)) ||
          normalizedFileName.includes(epStr) ||
          normalizedFolderName.includes(epStr)
        );
        if (hasEpMatch) return file;
      } else {
        // For movies, if we have a year, try to confirm it
        if (year && (info.year || folderInfo.year)) {
          const matchedYear = info.year || folderInfo.year;
          if (matchedYear === parseInt(year)) return file;
        } else {
          // If no year specified or found, just trust the title match
          return file;
        }
      }
    }
  }
  return null;
}

module.exports = {
  parseLocalFilename,
  scanDirectory,
  enrichWithTMDB,
  findMediaFiles,
  findLocalMatch,
};
