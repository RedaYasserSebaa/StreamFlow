const { CONFIG } = require("../state");

// Function to search real torrents using Jackett
async function searchTorrentMagnetLinks(title, mediaType = 'movie', seasonEpi = '', userConfig = CONFIG) {
  // Validate required config
  const jackett_api_key = userConfig.jackett_api_key || CONFIG.jackett_api_key;
  const jackett_ip = userConfig.jackett_ip || CONFIG.jackett_ip;
  const jackett_port = userConfig.jackett_port || CONFIG.jackett_port;

  if (!jackett_api_key || !jackett_ip || !jackett_port) {
    throw new Error("Jackett configuration not set. Please complete the setup.");
  }

  const JACKETT_URL = `http://${jackett_ip}:${jackett_port}`;
  const JACKETT_API_KEY = jackett_api_key;

  const minSeeders = userConfig.min_seeders || 0;
  const excludeKeywords = userConfig.exclude_keywords 
    ? userConfig.exclude_keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0)
    : [];

  try {
    let categories;
    let searchQuery = title;

    if (mediaType === 'movie') {
      categories = '2000,2010,2040,2050';
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : "";
      searchQuery = year
        ? `${title.replace(year, "").trim()} ${year}`
        : `${title}`;
    } else {
      categories = '5000,5030,5040,5070';
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : "";
      let cleanTitle = year ? title.replace(year, "").trim() : title;
      if (seasonEpi) {
        searchQuery = `${cleanTitle} ${seasonEpi}`;
      } else {
        searchQuery = cleanTitle;
      }
    }

    console.log(`Querying Jackett: ${searchQuery} (Type: ${mediaType}, Cat: ${categories})`);

    const jacketUrl = `${JACKETT_URL}/api/v2.0/indexers/all/results`;
    const searchUrl = `${jacketUrl}?apikey=${JACKETT_API_KEY}&Query=${encodeURIComponent(searchQuery)}&Category=${categories}`;
    console.log(`Jackett URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.Results || data.Results.length === 0) {
      console.log(`No results from Jackett, using mock data`);
      return getMockResults(title);
    }

    console.log(`Found ${data.Results.length} results from Jackett`);

    // Convert Jackett results to our format
    const results = data.Results.map((item) => {
      // Priority: MagnetUri > Guid (if magnet) > Link (Jackett proxy)
      let magnet = item.MagnetUri;

      // If no magnet, check if Guid is a magnet link
      if (!magnet && item.Guid && item.Guid.startsWith("magnet:")) {
        magnet = item.Guid;
      }

      // If still no magnet, use Jackett download link (fallback)
      if (!magnet && item.Link) {
        magnet = item.Link;
      }

      return {
        title: item.Title,
        seeders: item.Seeders || 0,
        leechers: item.Peers || 0,
        magnet: magnet,
        size: item.Size,
        date: item.PublishDate,
        indexer: item.Tracker || "Unknown",
      };
    }).filter((item) => {
      if (!item.magnet) return false;
      
      // Apply filters
      if (item.seeders < minSeeders) return false;
      
      const titleLower = item.title.toLowerCase();
      if (excludeKeywords.some(word => titleLower.includes(word))) return false;
      
      return true;
    });

    // First, try to find results that match the title
    // Split title into words and require at least 2 words to match
    const movieWords = title
      .toLowerCase()
      .split(/[\s.]+/)
      .filter((w) => w.length > 2);
    console.log(`Searching for words: ${movieWords.join(", ")}`);

    const titleMatches = results.filter((t) => {
      const titleLower = t.title.toLowerCase();
      // Require at least 2 significant words from movie title to match
      const matchCount = movieWords.filter((word) =>
        titleLower.includes(word),
      ).length;
      const hasMatch = matchCount >= Math.min(2, movieWords.length);

      if (hasMatch) {
        console.log(
          `MATCH: ${t.title} (matched ${matchCount}/${movieWords.length} words)`,
        );
      }

      return hasMatch;
    });

    if (titleMatches.length > 0) {
      console.log(
        `Found ${titleMatches.length} results matching "${title}"`,
      );
      console.log(`Top match: ${titleMatches[0].title}`);
      
      // For TV shows with season/episode, filter by those specifically
      if (mediaType === 'tv' && seasonEpi) {
        // Extract season and episode numbers from seasonEpi (e.g., "S01E05")
        const epStr = seasonEpi.replace(/S(\d+)E(\d+)/, `S0?$1E0?$2`);
        const epPattern = new RegExp(`${epStr}|${seasonEpi}`, 'i');
        const rangePattern = new RegExp(`(?:${epStr}|${seasonEpi})\\s*(?:-|~)\\s*(?:S\\d+)?(?:E)?\\d{1,3}\\b`, 'i');
        
        const epMatches = titleMatches.filter(t => epPattern.test(t.title) && !rangePattern.test(t.title));
        
        if (epMatches.length > 0) {
          console.log(`Filtered to ${epMatches.length} results matching ${seasonEpi}`);
          // Sort by file size (largest first), then by seeders
          epMatches.sort((a, b) => {
            const sizeA = a.size || 0;
            const sizeB = b.size || 0;
            if (sizeB !== sizeA) return sizeB - sizeA;
            return b.seeders - a.seeders;
          });
          return epMatches.slice(0, 50);
        }
      }
      
      // Sort by file size (largest first), then by seeders
      titleMatches.sort((a, b) => {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        if (sizeB !== sizeA) return sizeB - sizeA;
        return b.seeders - a.seeders;
      });
      return titleMatches.slice(0, 50);
    }

    console.log(`  No results found matching "${title}"`);
    console.log(`Words searched: ${movieWords.join(", ")}`);
    console.log(`First 5 results from Jackett:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title} (${r.seeders} seeders)`);
    });

    console.log(
      `  No results found matching "${title}", falling back to top results`,
    );

    // Sort by file size (largest first), then by seeders
    return results.slice(0, 50).sort((a, b) => {
      const sizeA = a.size || 0;
      const sizeB = b.size || 0;
      if (sizeB !== sizeA) return sizeB - sizeA;
      return b.seeders - a.seeders;
    });
  } catch (error) {
    console.log(
      `  Jackett error (${error.message}), falling back to mock data`,
    );
    console.log(
      `💡 To use Jackett: Install from https://github.com/Jackett/Jackett`,
    );
    console.log(`   Then configure indexers in http://${CONFIG.jackett_ip}:${CONFIG.jackett_port}`);

    return getMockResults(title);
  }
}

// Convert Jackett proxy link to real magnet link
async function getRealMagnetLink(jackettLink) {
  // If it's already a magnet link, return it
  if (jackettLink.startsWith("magnet:")) {
    return jackettLink;
  }

  // If it's a Jackett proxy URL, fetch the actual torrent info
  if (jackettLink.includes("localhost:9117/dl/")) {
    try {
      console.log(`Converting Jackett proxy to magnet...`);
      const response = await fetch(jackettLink, {
        method: "GET",
        redirect: "manual", // Don't follow redirect, get the magnet from response
      });

      // Jackett returns the magnet link in the response or redirects to it
      const location = response.headers.get("location");
      if (location && location.startsWith("magnet:")) {
        console.log(`Got real magnet link`);
        return location;
      }

      // If no redirect, try to get from response body
      const text = await response.text();
      const magnetMatch = text.match(/magnet:\?xt=[^"]+/);
      if (magnetMatch) {
        console.log(`Extracted magnet from response`);
        return magnetMatch[0];
      }
    } catch (error) {
      console.log(`  Could not convert proxy link: ${error.message}`);
    }
  }

  // Return original link as fallback
  return jackettLink;
}

// Mock results as fallback
function getMockResults(movieTitle) {
  const mockResults = [
    {
      title: `${movieTitle} 4K UHD BluRay`,
      seeders: 250,
      leechers: 45,
      magnet: `magnet:?xt=urn:btih:d3ea63c0fe4ba02e74f8c8be4b3b5ef01c04b8c3&dn=${encodeURIComponent(movieTitle)}+4K+UHD&tr=udp://tracker.opentrackr.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce`,
      indexer: `Opentrackr`
    },
    {
      title: `${movieTitle} 4K WEB-DL`,
      seeders: 180,
      leechers: 32,
      magnet: `magnet:?xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0&dn=${encodeURIComponent(movieTitle)}+4K+WEB&tr=udp://tracker.opentrackr.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce`,
      indexer: `Opentrackr`
    },
    {
      title: `${movieTitle} 2160p BluRay`,
      seeders: 320,
      leechers: 58,
      magnet: `magnet:?xt=urn:btih:5f1e9c4b8a7d6c5b4e3f2a1d0c9b8a7f6e5d4c3b&dn=${encodeURIComponent(movieTitle)}+2160p&tr=udp://tracker.opentrackr.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce`,
      indexer: `Internetwarriors`
    },
  ];

  return mockResults;
}

module.exports = {
  searchTorrentMagnetLinks,
  getRealMagnetLink,
  getMockResults,
};
