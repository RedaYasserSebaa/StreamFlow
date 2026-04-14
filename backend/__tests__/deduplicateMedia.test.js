const { deduplicateMedia } = require('../deduplicateMedia');

/**
 * Regression tests for the duplicate TV-show bug fixed in commit 8bedb162.
 *
 * Before the fix, every episode file of the same TV show was returned as a
 * separate entry by the /api/local endpoint.  A show with 5 episodes would
 * appear 5 times in the library view.  The fix deduplicates TV episodes by
 * TMDB id (or title when TMDB data is unavailable) and collapses them into a
 * single grouped entry with an `episodesFound` count.
 */

// ---------------------------------------------------------------------------
// Helpers to build realistic enriched-media fixtures
// ---------------------------------------------------------------------------

function makeTvEpisode(overrides = {}) {
  return {
    type: 'tv',
    media_type: 'tv',
    id: 1399,
    title: 'Breaking Bad',
    name: 'Breaking Bad',
    overview: 'A chemistry teacher turned meth maker.',
    poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    vote_average: 8.9,
    release_date: '2008-01-20',
    isLocal: true,
    localId: `local_1399_${Math.random().toString(36).slice(2, 10)}`,
    filename: 'Breaking.Bad.S01E01.mp4',
    localPath: '/tv/Breaking Bad/S01E01.mp4',
    season: 1,
    episode: 1,
    size: 500_000_000,
    ...overrides,
  };
}

function makeMovie(overrides = {}) {
  return {
    type: 'movie',
    media_type: 'movie',
    id: 550,
    title: 'Fight Club',
    overview: 'An insomniac and a soap maker...',
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    vote_average: 8.4,
    release_date: '1999-10-15',
    isLocal: true,
    localId: `local_550_${Math.random().toString(36).slice(2, 10)}`,
    filename: 'Fight.Club.1999.mp4',
    localPath: '/movies/Fight Club (1999)/Fight.Club.1999.mp4',
    size: 1_500_000_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deduplicateMedia – TV-show duplicate regression (commit 8bedb162)', () => {
  test('multiple episodes of the same show (same TMDB id) collapse into one entry', () => {
    const episodes = [
      makeTvEpisode({ season: 1, episode: 1, filename: 'Breaking.Bad.S01E01.mp4', localPath: '/tv/BB/S01E01.mp4' }),
      makeTvEpisode({ season: 1, episode: 2, filename: 'Breaking.Bad.S01E02.mp4', localPath: '/tv/BB/S01E02.mp4' }),
      makeTvEpisode({ season: 1, episode: 3, filename: 'Breaking.Bad.S01E03.mp4', localPath: '/tv/BB/S01E03.mp4' }),
      makeTvEpisode({ season: 2, episode: 1, filename: 'Breaking.Bad.S02E01.mp4', localPath: '/tv/BB/S02E01.mp4' }),
      makeTvEpisode({ season: 2, episode: 2, filename: 'Breaking.Bad.S02E02.mp4', localPath: '/tv/BB/S02E02.mp4' }),
    ];

    const results = deduplicateMedia(episodes);

    // Before the fix this would have returned 5 entries — one per episode.
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Breaking Bad');
    expect(results[0].isGrouped).toBe(true);
    expect(results[0].episodesFound).toBe(5);
  });

  test('movies are never deduplicated — each movie stays its own entry', () => {
    const items = [
      makeMovie({ id: 550, title: 'Fight Club' }),
      makeMovie({ id: 680, title: 'Pulp Fiction' }),
    ];

    const results = deduplicateMedia(items);

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Fight Club');
    expect(results[1].title).toBe('Pulp Fiction');
    // Movies should NOT have the grouping flags
    expect(results[0].isGrouped).toBeUndefined();
    expect(results[1].isGrouped).toBeUndefined();
  });

  test('mixed movies and TV episodes deduplicate only the TV shows', () => {
    const items = [
      makeMovie({ id: 550, title: 'Fight Club' }),
      makeTvEpisode({ id: 1399, season: 1, episode: 1 }),
      makeTvEpisode({ id: 1399, season: 1, episode: 2 }),
      makeTvEpisode({ id: 1399, season: 1, episode: 3 }),
      makeMovie({ id: 680, title: 'Pulp Fiction' }),
    ];

    const results = deduplicateMedia(items);

    // 2 movies + 1 grouped TV show = 3
    expect(results).toHaveLength(3);

    const movies = results.filter(r => r.media_type === 'movie');
    const tvShows = results.filter(r => r.media_type === 'tv');

    expect(movies).toHaveLength(2);
    expect(tvShows).toHaveLength(1);
    expect(tvShows[0].episodesFound).toBe(3);
  });

  test('TV shows without TMDB ids are grouped by normalised title', () => {
    // When TMDB enrichment fails, items have no `id` — dedup falls back to title
    const episodes = [
      makeTvEpisode({ id: undefined, title: 'My Obscure Show', season: 1, episode: 1 }),
      makeTvEpisode({ id: undefined, title: 'my obscure show', season: 1, episode: 2 }),
      makeTvEpisode({ id: undefined, title: ' My Obscure Show ', season: 1, episode: 3 }),
    ];

    const results = deduplicateMedia(episodes);

    expect(results).toHaveLength(1);
    expect(results[0].episodesFound).toBe(3);
    expect(results[0].isGrouped).toBe(true);
  });

  test('different TV shows with different TMDB ids remain separate', () => {
    const items = [
      makeTvEpisode({ id: 1399, title: 'Breaking Bad', season: 1, episode: 1 }),
      makeTvEpisode({ id: 1399, title: 'Breaking Bad', season: 1, episode: 2 }),
      makeTvEpisode({ id: 66732, title: 'Stranger Things', season: 1, episode: 1 }),
      makeTvEpisode({ id: 66732, title: 'Stranger Things', season: 1, episode: 2 }),
      makeTvEpisode({ id: 66732, title: 'Stranger Things', season: 1, episode: 3 }),
    ];

    const results = deduplicateMedia(items);

    expect(results).toHaveLength(2);
    const bb = results.find(r => r.title === 'Breaking Bad');
    const st = results.find(r => r.title === 'Stranger Things');
    expect(bb.episodesFound).toBe(2);
    expect(st.episodesFound).toBe(3);
  });

  test('a single TV episode is still marked as grouped with episodesFound = 1', () => {
    const items = [makeTvEpisode({ id: 1399, season: 1, episode: 1 })];

    const results = deduplicateMedia(items);

    expect(results).toHaveLength(1);
    expect(results[0].isGrouped).toBe(true);
    expect(results[0].episodesFound).toBe(1);
  });

  test('empty input returns empty output', () => {
    expect(deduplicateMedia([])).toEqual([]);
  });
});
