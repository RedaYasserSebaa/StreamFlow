/**
 * Deduplicates TV show episodes from enriched media data.
 *
 * Without deduplication, each episode file of the same TV show appears as a
 * separate card in the library view.  This helper collapses them into a single
 * entry per show (keyed by TMDB id or title) and tracks how many episodes were
 * found.  Movies pass through untouched.
 *
 * @param {Array} enrichedData – Items returned by enrichWithTMDB().
 * @returns {Array} Deduplicated list (movies + one entry per TV show).
 */
function deduplicateMedia(enrichedData) {
  const groupedResults = [];
  const tvMap = new Map();

  for (const item of enrichedData) {
    if (item.media_type === 'movie') {
      groupedResults.push(item);
    } else {
      // Group by TMDB id when available, otherwise by normalised title
      const showKey = item.id
        ? `tmdb_${item.id}`
        : `title_${item.title.toLowerCase().trim()}`;

      if (!tvMap.has(showKey)) {
        tvMap.set(showKey, {
          ...item,
          isGrouped: true,
          episodesFound: 1,
        });
      } else {
        const existing = tvMap.get(showKey);
        existing.episodesFound++;
      }
    }
  }

  return [...groupedResults, ...Array.from(tvMap.values())];
}

module.exports = { deduplicateMedia };
