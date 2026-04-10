// --- CHECK IF SETUP IS COMPLETE ---
function checkSetupComplete() {
    const config = localStorage.getItem('streamFlowConfig');
    if (!config) {
        window.location.href = 'setup.html';
        return false;
    }
    return JSON.parse(config);
}

const CONFIG_DATA = checkSetupComplete();

// --- CONFIG ---
const API_KEY = CONFIG_DATA.tmdb_api_key;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const savedBackendUrl = CONFIG_DATA.backend_url || '';
const API_BASE = (savedBackendUrl && !savedBackendUrl.includes('localhost:3001')) 
    ? savedBackendUrl 
    : window.location.origin;
const SEARCH_URL = `${API_BASE}/api/search`;
const STREAM_URL = `${API_BASE}/api/stream`;
// --- STATE ---
let homePage = 1;
let categoryPage = 1;
let currentView = 'home';
let currentGenreId = 0;
let currentGenreName = '';
let userLists = JSON.parse(localStorage.getItem('myMovieLists')) || {}; 
let currentMovieData = null;
let isFetching = false;

// --- CHECK MOBILE ---
function isMobile() {
    return window.innerWidth <= 768;
}

// --- OPEN SETTINGS ---
function openSetup() {
    loadSettings();
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function loadSettings() {
    const config = localStorage.getItem('streamFlowConfig');
    if (!config) return;
    
    const settings = JSON.parse(config);
    
    document.getElementById('settingsTmdbKey').value = settings.tmdb_api_key || '';
    document.getElementById('settingsJackettKey').value = settings.jackett_api_key || '';
    document.getElementById('settingsJackettIp').value = settings.jackett_ip || 'localhost';
    document.getElementById('settingsJackettPort').value = settings.jackett_port || '9117';
    document.getElementById('settingsBackendUrl').value = (settings.backend_url && !settings.backend_url.includes('localhost:3001')) ? settings.backend_url : window.location.origin;
}

async function saveSettings(e) {
    e.preventDefault();
    
    const config = {
        tmdb_api_key: document.getElementById('settingsTmdbKey').value,
        jackett_api_key: document.getElementById('settingsJackettKey').value,
        jackett_ip: document.getElementById('settingsJackettIp').value,
        jackett_port: document.getElementById('settingsJackettPort').value,
        backend_url: document.getElementById('settingsBackendUrl').value
    };

    // Save to localStorage
    localStorage.setItem('streamFlowConfig', JSON.stringify(config));
    
    // Save to backend
    try {
        const response = await fetch(`${config.backend_url}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            showSettingsStatus('settingsMessage', '✅ Settings saved successfully!', 'success');
            // Reload page to apply new settings (especially TMDB key changes)
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showSettingsStatus('settingsMessage', '⚠️ Settings saved locally but backend may be offline', 'info');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    } catch (error) {
        showSettingsStatus('settingsMessage', '⚠️ Settings saved locally but backend may be offline', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
}

function showSettingsStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
    el.className = `settings-status-message show ${type}`;
    
    if (type === 'error') {
        setTimeout(() => {
            el.classList.remove('show');
        }, 5000);
    }
}

async function testJackettFromSettings() {
    const ip = document.getElementById('settingsJackettIp').value;
    const port = document.getElementById('settingsJackettPort').value;
    const apiKey = document.getElementById('settingsJackettKey').value;

    if (!apiKey || !ip || !port) {
        showSettingsStatus('settingsJackettStatus', '⚠️ Please fill in all Jackett fields', 'error');
        return;
    }

    showSettingsStatus('settingsJackettStatus', '🔍 Testing Jackett connection...', 'info');

    try {
        const backendUrl = document.getElementById('settingsBackendUrl').value || window.location.origin;
        const response = await fetch(`${backendUrl}/api/test-jackett`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jackett_ip: ip,
                jackett_port: port,
                jackett_api_key: apiKey
            }),
            signal: AbortSignal.timeout(10000)
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            showSettingsStatus('settingsJackettStatus', '✅ Jackett connection successful!', 'success');
        } else {
            showSettingsStatus('settingsJackettStatus', `❌ ${data.error || 'Jackett error'}`, 'error');
        }
    } catch (error) {
        showSettingsStatus('settingsJackettStatus', `❌ Cannot connect to Jackett: ${error.message}`, 'error');
    }
}

// --- UPDATE NAVIGATION UI ---
function updateNavigationUI() {
    const isMobileView = isMobile();
    const bottomNav = document.getElementById('bottomNav');
    const sidebar = document.querySelector('.sidebar');
    
    if (isMobileView) {
        bottomNav.classList.remove('hidden');
        sidebar.classList.add('hidden');
    } else {
        bottomNav.classList.add('hidden');
        sidebar.classList.remove('hidden');
    }

    // Update active state for both navs
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));

    if(currentView === 'home') {
        document.querySelectorAll('.nav-item')[0]?.classList.add('active');
        document.querySelectorAll('.bottom-nav-item')[0]?.classList.add('active');
    } else if(currentView === 'discover' || currentView === 'categories') {
        document.querySelectorAll('.nav-item')[1]?.classList.add('active');
        document.querySelectorAll('.bottom-nav-item')[1]?.classList.add('active');
    } else if(currentView === 'lists') {
        document.querySelectorAll('.nav-item')[2]?.classList.add('active');
        document.querySelectorAll('.bottom-nav-item')[2]?.classList.add('active');
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateNavigationUI();
    loadHomeData();
    initDiscoverFilters();
    
    // Update nav on resize
    window.addEventListener('resize', updateNavigationUI);
    
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value;
        searchTimeout = setTimeout(() => {
            if(query.length > 2) {
                if (currentView !== 'discover') {
                    navigate('discover');
                    document.getElementById('searchInput').value = query;
                }
                searchMovies(query);
            } else if (query.length === 0) {
                if (currentView === 'discover') resetDiscover();
                else if (currentView === 'home') loadHomeData();
            }
        }, 500);
    });
});

// --- NAVIGATION ---
function navigate(view) {
    if (view === 'categories') view = 'discover'; 
    currentView = view;
    discoverPage = 1;
    
    updateNavigationUI();

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-discover').classList.add('hidden');
    document.getElementById('view-lists').classList.add('hidden');

    if (view === 'home') {
        document.getElementById('view-home').classList.remove('hidden');
        document.getElementById('searchInput').value = '';
        document.getElementById('pageTitle').innerText = "StreamFlow Home";
        loadHomeData();
    } else if (view === 'discover') {
        document.getElementById('view-discover').classList.remove('hidden');
        document.getElementById('pageTitle').innerText = "Discover";
        document.getElementById('searchInput').value = '';
        resetDiscover();
    } else if (view === 'lists') {
        document.getElementById('view-lists').classList.remove('hidden');
        document.getElementById('pageTitle').innerText = "My Lists";
        document.getElementById('searchInput').value = '';
        renderListsPage();
    }

    // Scroll to top on navigation
    document.querySelector('.main-content').scrollTop = 0;
}

// --- API CALLS ---
async function loadHomeData() {
    if(isFetching) return;
    isFetching = true;
    
    try {
        // Load Continue Watching
        const continueWatching = JSON.parse(localStorage.getItem('continueWatching')) || [];
        const cwContainer = document.getElementById('row-continue');
        const cwGrid = document.getElementById('grid-continue');
        if (continueWatching.length > 0) {
            cwContainer.style.display = 'block';
            cwGrid.innerHTML = '';
            renderMovies(continueWatching, cwGrid, true);
        } else {
            cwContainer.style.display = 'none';
        }

        // Fetch parallel
        const [popMovies, popTv, featMovies, featTv] = await Promise.all([
            fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}`).then(r => r.json())
        ]);
        
        document.getElementById('grid-pop-movies').innerHTML = '';
        renderMovies(popMovies.results, document.getElementById('grid-pop-movies'));
        
        document.getElementById('grid-pop-tv').innerHTML = '';
        renderMovies(popTv.results, document.getElementById('grid-pop-tv'));
        
        document.getElementById('grid-feat-movies').innerHTML = '';
        renderMovies(featMovies.results, document.getElementById('grid-feat-movies'));
        
        document.getElementById('grid-feat-tv').innerHTML = '';
        renderMovies(featTv.results, document.getElementById('grid-feat-tv'));
        
    } catch(error) {
        console.error('Error fetching home data:', error);
    } finally {
        isFetching = false;
    }
}

async function searchMovies(query) {
    if(isFetching) return;
    isFetching = true;
    const grid = document.getElementById('discoverResultGrid');
    grid.innerHTML = '';
    document.getElementById('discoverLoadMoreBtn').style.display = 'none';
    
    try {
        const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if(data.results && data.results.length > 0) {
            const filtered = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
            renderMovies(filtered, grid);
        } else {
            grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1; padding: 20px;">No results found.</p>';
        }
    } catch(error) {
        console.error('Error searching:', error);
    } finally {
        isFetching = false;
    }
}

let discoverPage = 1;

async function initDiscoverFilters() {
    // Populate Years
    const yearSelect = document.getElementById('discYear');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 1; y >= 1990; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        yearSelect.appendChild(opt);
    }
    
    // Initial genres population based on default (movie)
    await populateGenresForType('movie');
}

async function populateGenresForType(type) {
    const genreSelect = document.getElementById('discGenre');
    genreSelect.innerHTML = '<option value="" selected>All Genres</option>';
    
    if (type === 'anime') return;
    
    try {
        const res = await fetch(`${BASE_URL}/genre/${type}/list?api_key=${API_KEY}`);
        const data = await res.json();
        data.genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.innerText = g.name;
            genreSelect.appendChild(opt);
        });
    } catch(e) {
        console.error('Error fetching genres:', e);
    }
}

async function onDiscoverTypeChange() {
    const type = document.getElementById('discType').value;
    if (type !== 'anime') {
        await populateGenresForType(type);
    } else {
        document.getElementById('discGenre').innerHTML = '<option value="" selected>All Genres</option>';
        document.getElementById('discGenre').disabled = true;
    }
    
    if (type !== 'anime') document.getElementById('discGenre').disabled = false;
    
    resetDiscover();
}

function onDiscoverFilterChange() {
    resetDiscover();
}

async function resetDiscover() {
    discoverPage = 1;
    document.getElementById('discoverResultGrid').innerHTML = '';
    loadDiscoverData();
}

async function loadDiscoverData() {
    if(isFetching) return;
    isFetching = true;

    const grid = document.getElementById('discoverResultGrid');
    const typeSelect = document.getElementById('discType').value;
    const genreId = document.getElementById('discGenre').value;
    const year = document.getElementById('discYear').value;
    
    let endpoint = `${BASE_URL}/discover/`;
    let queryParams = `?api_key=${API_KEY}&page=${discoverPage}`;
    
    if (typeSelect === 'anime') {
        endpoint += 'tv';
        queryParams += `&with_genres=16&with_original_language=ja`;
        if (year) queryParams += `&first_air_date_year=${year}`;
    } else if (typeSelect === 'tv') {
        endpoint += 'tv';
        if (genreId) queryParams += `&with_genres=${genreId}`;
        if (year) queryParams += `&first_air_date_year=${year}`;
    } else {
        endpoint += 'movie';
        if (genreId) queryParams += `&with_genres=${genreId}`;
        if (year) queryParams += `&primary_release_year=${year}`;
    }

    try {
        const res = await fetch(endpoint + queryParams);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            renderMovies(data.results, grid);
            document.getElementById('discoverLoadMoreBtn').style.display = 'inline-flex';
        } else {
            if (discoverPage === 1) grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1; padding: 20px;">No content found.</p>';
            document.getElementById('discoverLoadMoreBtn').style.display = 'none';
        }
    } catch(error) {
        console.error('Error loading discover:', error);
    } finally {
        isFetching = false;
    }
}

function loadMoreDiscover() {
    if(!isFetching) {
        discoverPage++;
        loadDiscoverData();
    }
}

function renderMovies(movies, container, isContinueWatching = false) {
    if(!movies || movies.length === 0) return;
    
    movies.forEach(movie => {
        if(!movie.poster_path) return;
        const title = movie.title || movie.name;
        const releaseDate = movie.release_date || movie.first_air_date;
        const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
        if(!movie.media_type) {
            movie.media_type = currentView === 'tv' || currentView === 'anime' ? 'tv' : 'movie';
        }
        
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openModal(movie);
        
        let removeBtnHtml = '';
        if (isContinueWatching) {
            removeBtnHtml = `
                <button class="btn-remove" onclick="event.stopPropagation(); removeFromContinueWatching(${movie.id})" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        // Check if it's a TV show
        const isTV = movie.media_type === 'tv' || movie.first_air_date;
        
        let extraInfoHtml = '';
        if (isTV) {
            // Fetch TV details asynchronously
            fetchAndDisplayTVInfo(movie, card);
            extraInfoHtml = `<div class="card-tv-info" id="tv-info-${movie.id}" style="font-size: 12px; color: #10b981; margin-top: 8px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
        }
        
        card.innerHTML = `
            ${removeBtnHtml}
            <img src="${IMG_URL + movie.poster_path}" loading="lazy" alt="${title}">
            <div class="card-body">
                <div class="card-title">${title}</div>
                <div class="card-meta">
                    <span>${year}</span>
                    <span><i class="fas fa-star" style="color:#fbbf24"></i> ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
                </div>
                ${extraInfoHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

async function fetchAndDisplayTVInfo(tvShow, cardElement) {
    try {
        const res = await fetch(`${BASE_URL}/tv/${tvShow.id}?api_key=${API_KEY}`);
        const data = await res.json();
        
        const numSeasons = data.number_of_seasons || 0;
        const numEpisodes = data.number_of_episodes || 0;
        
        const infoElement = document.getElementById(`tv-info-${tvShow.id}`);
        if (infoElement) {
            infoElement.innerHTML = `
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <span><i class="fas fa-play-circle"></i> ${numSeasons} ${numSeasons === 1 ? 'Season' : 'Seasons'}</span>
                    <span><i class="fas fa-list"></i> ${numEpisodes} ${numEpisodes === 1 ? 'Episode' : 'Episodes'}</span>
                </div>
            `;
        }
        
        // Also store in the movie object for later use
        tvShow.number_of_seasons = numSeasons;
        tvShow.number_of_episodes = numEpisodes;
    } catch (error) {
        console.error('Error fetching TV info:', error);
        const infoElement = document.getElementById(`tv-info-${tvShow.id}`);
        if (infoElement) {
            infoElement.innerHTML = '';
        }
    }
}

function removeFromContinueWatching(id) {
    let cw = JSON.parse(localStorage.getItem('continueWatching')) || [];
    cw = cw.filter(m => m.id !== id);
    localStorage.setItem('continueWatching', JSON.stringify(cw));
    
    const cwContainer = document.getElementById('row-continue');
    const cwGrid = document.getElementById('grid-continue');
    
    if (cw.length > 0) {
        cwContainer.style.display = 'block';
        cwGrid.innerHTML = '';
        renderMovies(cw, cwGrid, true);
    } else {
        cwContainer.style.display = 'none';
        cwGrid.innerHTML = '';
    }
}



// --- LIST MANAGEMENT ---
function createNewList() {
    const name = document.getElementById('newListName').value.trim();
    if(!name) return alert("Please enter a list name");
    if(userLists[name]) return alert("List already exists!");

    userLists[name] = [];
    saveLists();
    renderListsPage();
    document.getElementById('newListName').value = '';
}

function deleteList(name) {
    if(confirm(`Are you sure you want to delete "${name}"?`)) {
        delete userLists[name];
        saveLists();
        renderListsPage();
    }
}

function removeMovieFromList(listName, movieId) {
    userLists[listName] = userLists[listName].filter(m => m.id !== movieId);
    saveLists();
    renderListsPage();
}

function saveLists() {
    localStorage.setItem('myMovieLists', JSON.stringify(userLists));
}

function renderListsPage() {
    const container = document.getElementById('listsContainer');
    container.innerHTML = '';
    
    const listNames = Object.keys(userLists);
    
    if(listNames.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3 style="margin-bottom: 10px;">No Lists Yet</h3>
                <p>Create your first list above to start saving movies!</p>
            </div>
        `;
        return;
    }

    listNames.forEach(name => {
        const movies = userLists[name];
        const section = document.createElement('div');
        section.className = 'list-section';
        
        let moviesHtml = '';
        if(movies.length === 0) {
            moviesHtml = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-film" style="font-size: 32px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>This list is empty. Add some movies!</p>
                </div>
            `;
        } else {
            moviesHtml = `<div class="list-movie-grid">`;
            movies.forEach(movie => {
                const posterUrl = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/150x225?text=No+Image';
                const title = movie.title || movie.name || 'Unknown Title';
                const releaseDate = movie.release_date || movie.first_air_date;
                const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
                const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                const overview = movie.overview ? movie.overview : 'No description available.';
                
                moviesHtml += `
                    <div class="list-movie-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
                        <button class="btn-remove" onclick="event.stopPropagation(); removeMovieFromList('${name.replace(/'/g, "\\'")}', ${movie.id})" title="Remove from list">
                            <i class="fas fa-times"></i>
                        </button>
                        <div class="list-movie-poster">
                            <img src="${posterUrl}" loading="lazy" alt="${title}">
                        </div>
                        <div class="list-movie-info">
                            <div>
                                <div class="list-movie-title">${title}</div>
                                <div class="list-movie-meta">
                                    <span><i class="fas fa-calendar"></i> ${year}</span>
                                    <span><i class="fas fa-star"></i> ${rating}</span>
                                </div>
                            </div>
                            <div class="list-movie-overview">${overview}</div>
                        </div>
                    </div>
                `;
            });
            moviesHtml += `</div>`;
        }

        section.innerHTML = `
            <div class="list-header">
                <h3>
                    <i class="fas fa-list-ul" style="color: #3b82f6; margin-right: 10px;"></i>
                    ${name} 
                    <span style="font-size: 14px; color: var(--text-muted); font-weight: normal; margin-left: 8px;">(${movies.length})</span>
                </h3>
                <button class="btn-danger" onclick="deleteList('${name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i> Delete List
                </button>
            </div>
            ${moviesHtml}
        `;
        container.appendChild(section);
    });
}

function addToCurrentList() {
    const listName = document.getElementById('listSelector').value;
    if(!listName) return alert("Please select a list first");
    if(!currentMovieData) return;
    
    const exists = userLists[listName].some(m => m.id === currentMovieData.id);
    
    if(!exists) {
        const movieDataToSave = {
            id: currentMovieData.id,
            title: currentMovieData.title || currentMovieData.name,
            poster_path: currentMovieData.poster_path,
            release_date: currentMovieData.release_date || currentMovieData.first_air_date,
            vote_average: currentMovieData.vote_average,
            overview: currentMovieData.overview,
            media_type: currentMovieData.media_type
        };
        userLists[listName].push(movieDataToSave);
        saveLists();
        
        const status = document.getElementById('downloadStatus');
        status.innerText = `✅ Added to "${listName}"!`;
        status.style.background = 'rgba(16, 185, 129, 0.2)';
        status.style.color = '#10b981';
        
        setTimeout(() => {
            status.innerText = '';
            status.style.background = 'rgba(0,0,0,0.2)';
            status.style.color = '';
        }, 3000);
    } else {
        alert("This movie is already in the selected list!");
    }
}

// --- MODAL LOGIC ---
function openModal(movie) {
    currentMovieData = movie;
    
    const posterUrl = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/150x225?text=No+Image';
    const backdropUrl = movie.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + movie.backdrop_path : posterUrl;
    const title = movie.title || movie.name || 'Unknown Title';
    const releaseDate = movie.release_date || movie.first_air_date;
    
    // Update newly restructured split modal fields
    const mPoster = document.getElementById('mPoster');
    if (mPoster) mPoster.src = posterUrl;
    
    const pBackdrop = document.getElementById('playerBackdrop');
    if (pBackdrop) {
        pBackdrop.src = backdropUrl;
        pBackdrop.style.display = 'block';
    }
    
    const pOverlayText = document.getElementById('playerOverlayText');
    if (pOverlayText) pOverlayText.style.display = 'block';
    
    const pContainer = document.getElementById('playerContainer');
    if (pContainer) pContainer.style.display = 'none';
    
    const pStats = document.getElementById('playerStats');
    if (pStats) {
        pStats.style.display = 'none';
        pStats.innerHTML = '';
    }

    document.getElementById('mTitle').innerText = title;
    document.getElementById('mDate').innerText = releaseDate ? `Released: ${releaseDate}` : 'Release Date: Unknown';
    document.getElementById('mDesc').innerText = movie.overview || 'No description available.';
    
    // Reset Player/Stream section
    const streamStatus = document.getElementById('streamStatus');
    if(streamStatus) {
        streamStatus.style.display = 'none';
        streamStatus.innerText = '';
    }
    const torrentList = document.getElementById('torrentList');
    if(torrentList) {
        torrentList.innerHTML = '';
    }
    
    // TV Selectors logic
    const tvSelectors = document.getElementById('tvSelectors');
    const seasonSelect = document.getElementById('seasonSelect');
    const episodeSelect = document.getElementById('episodeSelect');
    const searchBtn = document.getElementById('searchStreamsBtn');

    if (movie.media_type === 'tv' || movie.first_air_date) {
        tvSelectors.style.display = 'flex';
        searchBtn.style.display = 'none';
        seasonSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
        episodeSelect.innerHTML = '<option value="" disabled selected>Select Season first</option>';
        fetchTVDetails(movie.id);
    } else {
        tvSelectors.style.display = 'none';
        searchBtn.style.display = 'block';
    }
    
    const selector = document.getElementById('listSelector');
    selector.innerHTML = '<option value="" disabled selected>Select a list...</option>';
    
    const listNames = Object.keys(userLists);
    if(listNames.length === 0) {
        selector.innerHTML = '<option value="" disabled>No lists available. Create one first!</option>';
    } else {
        listNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            selector.appendChild(opt);
        });
    }

    document.getElementById('movieModal').style.display = 'flex';
}

async function fetchTVDetails(tvId) {
    try {
        const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
        const data = await res.json();
        currentMovieData.seasons = data.seasons;
        currentMovieData.number_of_seasons = data.number_of_seasons;
        currentMovieData.number_of_episodes = data.number_of_episodes;
        
        // Display season and episode info
        const mDate = document.getElementById('mDate');
        const seasonCount = data.number_of_seasons;
        const episodeCount = data.number_of_episodes;
        mDate.innerHTML = `
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px;">
                <span><i class="fas fa-calendar" style="color: #3b82f6; margin-right: 5px;"></i> ${currentMovieData.first_air_date || 'Unknown'}</span>
                <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981;">
                    <i class="fas fa-play-circle"></i> ${seasonCount} ${seasonCount === 1 ? 'Season' : 'Seasons'}
                </span>
                <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6;">
                    <i class="fas fa-list"></i> ${episodeCount} ${episodeCount === 1 ? 'Episode' : 'Episodes'}
                </span>
            </div>
        `;
        
        const seasonSelect = document.getElementById('seasonSelect');
        seasonSelect.innerHTML = '<option value="" disabled selected>Select Season</option>';
        data.seasons.forEach(s => {
            if (s.season_number > 0) {
                const opt = document.createElement('option');
                opt.value = s.season_number;
                opt.innerText = `Season ${s.season_number}`;
                seasonSelect.appendChild(opt);
            }
        });
    } catch(e) {
        console.error("Error fetching tv details", e);
    }
}

async function onSeasonChange() {
    const tvId = currentMovieData.id;
    const seasonNum = document.getElementById('seasonSelect').value;
    const episodeSelect = document.getElementById('episodeSelect');
    
    episodeSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
    
    try {
        const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNum}?api_key=${API_KEY}`);
        const data = await res.json();
        
        episodeSelect.innerHTML = '<option value="" disabled selected>Select Episode</option>';
        data.episodes.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.episode_number;
            opt.innerText = `Episode ${e.episode_number}: ${e.name}`;
            episodeSelect.appendChild(opt);
        });
        
        episodeSelect.onchange = () => {
            document.getElementById('searchStreamsBtn').style.display = 'block';
        };
    } catch(e) {
        console.error("Error fetching episodes", e);
    }
}

function closeModal() {
    // Stop the stream if it's playing
    if (streamStatsInterval) {
        clearInterval(streamStatsInterval);
        streamStatsInterval = null;
    }
    currentMagnet = null;

    const videoObj = document.getElementById('videoPlayer');
    if (videoObj) {
        videoObj.pause();
        videoObj.src = '';
    }

    document.getElementById('movieModal').style.display = 'none';
    
    // Hide panels
    const subPanel = document.getElementById('subtitleSettingsPanel');
    if (subPanel) subPanel.style.display = 'none';
    
    // Clean up stats
    const pStats = document.getElementById('playerStats');
    if (pStats) {
        pStats.style.display = 'none';
        pStats.innerHTML = '';
    }
}

let currentStreamResults = [];

async function searchStreams() {
    const title = document.getElementById('mTitle').innerText;
    const btn = document.getElementById('searchStreamsBtn');
    const status = document.getElementById('streamStatus');
    const list = document.getElementById('torrentList');
    const filterContainer = document.getElementById('streamFilters');
    
    btn.disabled = true;
    status.style.display = 'block';
    status.innerText = 'Searching Torrents...';
    status.style.background = 'rgba(59, 130, 246, 0.2)';
    status.style.color = '#3b82f6';
    list.innerHTML = '';
    filterContainer.style.display = 'none';
    
    const mediaType = currentMovieData.media_type === 'tv' ? 'tv' : 'movie';
    let seasonEpi = '';
    let episodeInfo = '';
    
    if (mediaType === 'tv') {
        const s = document.getElementById('seasonSelect').value;
        const e = document.getElementById('episodeSelect').value;
        if (s && e) {
            const paddedS = s.toString().padStart(2, '0');
            const paddedE = e.toString().padStart(2, '0');
            seasonEpi = `S${paddedS}E${paddedE}`;
            episodeInfo = `Season ${s} • Episode ${e}`;
        }
    }
    
    try {
        const res = await fetch(SEARCH_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title: title, type: mediaType, seasonEpi: seasonEpi })
        });
        const data = await res.json();
        
        if(res.ok && data.results && data.results.length > 0) {
            // Sort by file size (largest first), then by seeders
            const sortedResults = data.results.sort((a, b) => {
                const sizeA = a.size || 0;
                const sizeB = b.size || 0;
                if (sizeB !== sizeA) return sizeB - sizeA;
                return b.seeders - a.seeders;
            });
            
            let displayResults = sortedResults;
            if (mediaType === 'tv' && seasonEpi) {
                const epStr = seasonEpi.replace(/S(\d+)E(\d+)/, `S0?$1E0?$2`);
                const epPattern = new RegExp(`${epStr}|${seasonEpi}`, 'i');
                const rangePattern = new RegExp(`(?:${epStr}|${seasonEpi})\\s*(?:-|~)\\s*(?:S\\d+)?(?:E)?\\d{1,3}\\b`, 'i');

                // Filter out results that do not match the episode, or match a multi-episode range
                displayResults = sortedResults.filter(t => epPattern.test(t.title) && !rangePattern.test(t.title));
                
                if (displayResults.length > 0) {
                    status.style.display = 'block';
                    status.innerText = `📺 Showing results for ${episodeInfo} (${displayResults.length} found)`;
                    status.style.background = 'rgba(16, 185, 129, 0.1)';
                    status.style.color = '#10b981';
                    status.style.fontSize = '13px';
                    status.style.padding = '10px';
                    status.style.borderRadius = '8px';
                    status.style.marginBottom = '15px';
                } else {
                    displayResults = sortedResults;
                    status.style.display = 'block';
                    status.innerText = `⚠️ No exact matches for ${episodeInfo}. Showing all results below.`;
                    status.style.background = 'rgba(251, 146, 60, 0.1)';
                    status.style.color = '#fb923c';
                    status.style.fontSize = '13px';
                    status.style.padding = '10px';
                    status.style.borderRadius = '8px';
                    status.style.marginBottom = '15px';
                }
            } else {
                status.style.display = 'none';
            }
            
            // Process quality categories for all items
            displayResults.forEach(t => {
                const size = t.size || 0;
                const sizeGB = (size / 1024 / 1024 / 1024).toFixed(2);
                t.sizeGB = sizeGB;
                
                const titleLower = t.title.toLowerCase();
                
                if (titleLower.includes('2160p') || titleLower.includes('4k')) {
                    t.qualityCat = '4K';
                    t.qualityBadgeHtml = '<span style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">4K</span>';
                } else if (titleLower.includes('1080p') || titleLower.includes('fhd')) {
                    t.qualityCat = '1080p';
                    t.qualityBadgeHtml = '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">1080p</span>';
                } else if (titleLower.includes('720p') || titleLower.includes('hd')) {
                    t.qualityCat = '720p';
                    t.qualityBadgeHtml = '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">720p</span>';
                } else if (titleLower.includes('480p') || titleLower.includes('sd')) {
                    t.qualityCat = '480p';
                    t.qualityBadgeHtml = '<span style="background: #64748b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">480p</span>';
                } else {
                    // Fallback to size-based guessing if title does not indicate
                    if (sizeGB > 5) {
                        t.qualityCat = '4K';
                        t.qualityBadgeHtml = '<span style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">4K</span>';
                    } else if (sizeGB > 2.5) {
                        t.qualityCat = '1080p';
                        t.qualityBadgeHtml = '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">1080p</span>';
                    } else if (sizeGB > 1) {
                        t.qualityCat = '720p';
                        t.qualityBadgeHtml = '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">720p</span>';
                    } else {
                        t.qualityCat = 'SD';
                        t.qualityBadgeHtml = '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">SD</span>';
                    }
                }
            });

            currentStreamResults = displayResults;
            populateStreamFilters(displayResults);
            renderStreamResults(displayResults);

        } else {
            status.innerText = `❌ ${data.error || 'No streams found.'}`;
            status.style.background = 'rgba(239, 68, 68, 0.2)';
            status.style.color = '#ef4444';
        }
    } catch(e) {
        status.innerText = "❌ Backend offline. Make sure server.js is running!";
        status.style.background = 'rgba(239, 68, 68, 0.2)';
        status.style.color = '#ef4444';
    } finally {
        btn.disabled = false;
    }
}

function populateStreamFilters(results) {
    const qSelect = document.getElementById('qualityFilter');
    const iSelect = document.getElementById('indexerFilter');
    
    // Extract unique qualities & indexers
    const qualities = new Set();
    const indexers = new Set();
    
    results.forEach(t => {
        if (t.qualityCat) qualities.add(t.qualityCat);
        if (t.indexer) indexers.add(t.indexer);
    });
    
    // Build options
    qSelect.innerHTML = '<option value="all">All Qualities</option>';
    const qArray = Array.from(qualities);
    qArray.forEach(q => {
        // Option values
        qSelect.innerHTML += `<option value="${q}">${q}</option>`;
    });

    iSelect.innerHTML = '<option value="all">All Indexers</option>';
    const iArray = Array.from(indexers).sort();
    iArray.forEach(i => {
        iSelect.innerHTML += `<option value="${i.replace(/"/g, '&quot;')}">${i}</option>`;
    });

    if (results.length > 0) {
        document.getElementById('streamFilters').style.display = 'flex';
    }
}

function applyStreamFilters() {
    const qVal = document.getElementById('qualityFilter').value;
    const iVal = document.getElementById('indexerFilter').value;
    
    let filtered = currentStreamResults;
    
    if (qVal !== 'all') {
        filtered = filtered.filter(t => t.qualityCat === qVal);
    }
    
    if (iVal !== 'all') {
        filtered = filtered.filter(t => t.indexer === iVal);
    }
    
    renderStreamResults(filtered);
}

function renderStreamResults(results) {
    const list = document.getElementById('torrentList');
    list.innerHTML = '';
    
    if (results.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No streams match the selected filters.</p>';
        return;
    }

    results.forEach(t => {
        const indexerBadge = t.indexer ? `<span style="background: #ec4899; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;" title="${t.indexer}">${t.indexer}</span>` : '';
        
        const cardHtml = `
            <div class="torrent-card" style="padding: 15px; margin-bottom: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.25s; border: 1px solid transparent;" onclick="playTorrent('${t.magnet.replace(/'/g, "\\'")}', '${t.title.replace(/'/g, "\\'")}', '${t.indexer ? t.indexer.replace(/'/g, "\\'") : ''}')" onmouseover="this.style.background='rgba(59, 130, 246, 0.15)'; this.style.borderColor='rgba(59, 130, 246, 0.5)'; this.style.transform='translateX(4px)';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='transparent'; this.style.transform='translateX(0)';">
                <div style="flex: 1; min-width: 0; padding-right: 15px;">
                    <div style="font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; color: #f8fafc; margin-bottom: 8px;">${t.title}</div>
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <div style="font-size: 24px; font-weight: 700; color: #fbbf24; display: flex; align-items: baseline; gap: 4px;">
                            ${t.sizeGB}<span style="font-size: 12px; color: #94a3b8;">GB</span>
                        </div>
                        ${t.qualityBadgeHtml}
                        ${indexerBadge}
                        <span style="color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-arrow-up"></i> ${t.seeders}
                        </span>
                        <span style="color: #ef4444; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-arrow-down"></i> ${t.leechers}
                        </span>
                    </div>
                </div>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <a href="${t.magnet}" onclick="event.stopPropagation()" style="color: #cbd5e1; font-size: 20px; transition: color 0.2s; text-decoration: none;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'" title="Open Magnet Link">
                        <i class="fas fa-magnet"></i>
                    </a>
                    <div style="font-size: 28px; color: #3b82f6; animation: pulsePlay 2s ease-in-out infinite;" title="Direct Play">
                        <i class="fas fa-play-circle"></i>
                    </div>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', cardHtml);
    });
}

let streamStatsInterval = null;
let currentMagnet = null;

function playTorrent(magnetLink, title, indexer) {
    // Show stats block on right pane
    const statsEl = document.getElementById('playerStats');
    if (statsEl) {
        statsEl.style.display = 'block';
        statsEl.innerHTML = '<span style="color: #64748b;"><i class="fas fa-circle-notch fa-spin"></i> Connecting to peers...</span>';
    }
    
    currentMagnet = magnetLink;
    if (streamStatsInterval) clearInterval(streamStatsInterval);
    streamStatsInterval = setInterval(fetchStreamStats, 2000);
    
    
    // Save to Continue Watching
    if (currentMovieData) {
        let cw = JSON.parse(localStorage.getItem('continueWatching')) || [];
        // Remove if already exists to push to front
        cw = cw.filter(m => m.id !== currentMovieData.id);
        const cwData = {
            id: currentMovieData.id,
            title: currentMovieData.title || currentMovieData.name,
            poster_path: currentMovieData.poster_path,
            release_date: currentMovieData.release_date || currentMovieData.first_air_date,
            vote_average: currentMovieData.vote_average,
            overview: currentMovieData.overview,
            media_type: currentMovieData.media_type
        };
        cw.unshift(cwData);
        if (cw.length > 15) cw.pop();
        localStorage.setItem('continueWatching', JSON.stringify(cw));
        
        // Ensure "Home" view refreshes that row occasionally
    }

    // Construct streaming URL with indexer param
    let streamUrl = STREAM_URL + '?magnet=' + encodeURIComponent(magnetLink);
    if (indexer) {
        streamUrl += '&indexer=' + encodeURIComponent(indexer);
    }
    
    // Show inline player instead of opening a second modal
    const pOverlayText = document.getElementById('playerOverlayText');
    if (pOverlayText) pOverlayText.style.display = 'none';
    
    const pBackdrop = document.getElementById('playerBackdrop');
    if (pBackdrop) pBackdrop.style.display = 'none';
    
    document.getElementById('playerLoading').style.display = 'flex';
    document.getElementById('playerContainer').style.display = 'block';
    
    const videoObj = document.getElementById('videoPlayer');
    videoObj.src = streamUrl;
    
    if (!window.plyrInstance) {
        window.plyrInstance = new Plyr(videoObj, {
            captions: { active: true, update: true, language: 'auto' }
        });
    }
    
    videoObj.play().catch(e => console.log('Autoplay blocked', e));
}

async function fetchStreamStats() {
    if (!currentMagnet) return;
    try {
        const res = await fetch(`${API_BASE}/api/stream/stats?magnet=${encodeURIComponent(currentMagnet)}`);
        if (res.ok) {
            const data = await res.json();
            updateStreamStatsUI(data);
        }
    } catch(e) {
        console.error("Error fetching stats:", e);
    }
}

function updateStreamStatsUI(data) {
    const el = document.getElementById('playerStats');
    if(!el) return;
    
    let speedStr = "0 KB/s";
    let speed = data.speed;
    if (speed > 1024 * 1024) {
        speedStr = (speed / (1024 * 1024)).toFixed(2) + " MB/s";
    } else if (speed > 1024) {
        speedStr = (speed / 1024).toFixed(0) + " KB/s";
    } else {
        speedStr = speed + " B/s";
    }

    el.innerHTML = `
        <span style="color: #10b981; font-weight: 500;"><i class="fas fa-download"></i> ${speedStr}</span>
        <span style="margin: 0 10px; color: #475569;">|</span>
        <span style="color: #3b82f6; font-weight: 500;"><i class="fas fa-users"></i> ${data.peers} Peers</span>
        ${data.progress > 0 ? `<span style="margin: 0 10px; color: #475569;">|</span><span style="color: #8b5cf6; font-weight: 500;"><i class="fas fa-hdd"></i> Buffering: ${data.progress}%</span>` : ''}
    `;
}

window.onclick = function(event) {
    const movieModal = document.getElementById('movieModal');
    const settingsModal = document.getElementById('settingsModal');
    if (event.target == movieModal) closeModal();
    if (event.target == settingsModal) closeSettings();
}

function clearConfiguration() {
    if (confirm('⚠️ Are you sure you want to clear ALL configuration data? This cannot be undone and you will be taken back to setup.')) {
        // Clear all StreamFlow data from localStorage
        localStorage.removeItem('streamFlowConfig');
        localStorage.removeItem('myMovieLists');
        
        // Redirect to setup page
        window.location.href = 'setup.html';
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
        closeSettings();
    }
});

// Subtitle Logic
function srt2vtt(srt) {
    let vtt = "WEBVTT\n\n";
    vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return vtt;
}

function importSubtitle(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        let content = e.target.result;
        if (file.name.endsWith('.srt')) {
            content = srt2vtt(content);
        }

        const blob = new Blob([content], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        
        const video = document.getElementById('videoPlayer');
        
        // Remove existing tracks
        const tracks = video.getElementsByTagName('track');
        for (let i = tracks.length - 1; i >= 0; i--) {
            video.removeChild(tracks[i]);
        }
        
        const track = document.createElement('track');
        track.kind = 'captions';
        track.label = file.name;
        track.srclang = 'en';
        track.src = url;
        track.default = true;
        
        video.appendChild(track);
        
        if (window.plyrInstance) {
             setTimeout(() => {
                 window.plyrInstance.toggleCaptions(true);
             }, 500);
        }
    };
    reader.readAsText(file);
}

function toggleSubtitleSettings() {
    const panel = document.getElementById('subtitleSettingsPanel');
    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

function updateSubtitles() {
    const size = document.getElementById('subSize').value;
    const font = document.getElementById('subFont').value;
    const color = document.getElementById('subColor').value;
    
    // Toggle between a subtle backdrop or completely transparent
    const bgEnabled = document.getElementById('subBgToggle').checked;
    const bgColor = bgEnabled ? 'rgba(0, 0, 0, 0.75)' : 'transparent';
    
    document.getElementById('subSizeLabel').innerText = size + 'px';
    
    const root = document.documentElement;
    root.style.setProperty('--sub-size', size + 'px');
    root.style.setProperty('--sub-font', font);
    root.style.setProperty('--sub-color', color);
    root.style.setProperty('--sub-bg', bgColor);
}
