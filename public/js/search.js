// ===============================
// Search Page JavaScript (FIXED)
// ===============================

let currentPage = 1;
let totalPages = 1;
let userLocation = null;
let professions = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadProfessions();
    initFilters();
    parseURLParams();
    initLocationDetection();
});

// -------------------------------
// Helpers
// -------------------------------
const $ = (id) => document.getElementById(id);

function safeDisplay(el, value) {
    if (el) el.style.display = value;
}

// -------------------------------
// Navigation
// -------------------------------
function initNavigation() {
    const navToggle = $('navToggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
}

// -------------------------------
// Load Professions
// -------------------------------
async function loadProfessions() {
    const select = $('professionFilter');
    if (!select) return;

    try {
        const res = await fetch('/api/freelancers/professions');
        const data = await res.json();

        if (!data.success) return;

        professions = data.data;

        professions.forEach(prof => {
            const opt = document.createElement('option');
            opt.value = prof.id;
            opt.textContent = `${prof.icon} ${prof.name}`;
            select.appendChild(opt);
        });

        populateCategoryFilters(professions);

    } catch (err) {
        console.error('Profession load error:', err);
    }
}

// -------------------------------
// Category Filters
// -------------------------------
function populateCategoryFilters(list) {
    const container = $('categoryFilters');
    if (!container) return;

    container.innerHTML = list.slice(0, 8).map(p => `
        <button class="category-filter-btn" data-profession="${p.id}">
            <span>${p.icon}</span>
            <span>${p.name}</span>
        </button>
    `).join('');

    container.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const select = $('professionFilter');
            if (select) select.value = btn.dataset.profession;

            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentPage = 1;
            searchFreelancers();
        });
    });
}

// -------------------------------
// URL Params
// -------------------------------
function parseURLParams() {
    const params = new URLSearchParams(window.location.search);

    const profession = params.get('profession');
    const lat = params.get('lat');
    const lng = params.get('lng');

    if (profession && $('professionFilter')) {
        $('professionFilter').value = profession;
    }

    if (lat && lng) {
        userLocation = { latitude: +lat, longitude: +lng };
        updateLocationStatus(true);
    }

    searchFreelancers();
}

// -------------------------------
// Filters & Pagination
// -------------------------------
function initFilters() {
    $('searchBtn')?.addEventListener('click', () => {
        currentPage = 1;
        searchFreelancers();
    });

    $('resetFilters')?.addEventListener('click', resetFilters);

    $('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            searchFreelancers();
        }
    });

    $('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            searchFreelancers();
        }
    });

    const modal = $('freelancerModal');
    $('closeModal')?.addEventListener('click', () => modal?.classList.remove('show'));

    modal?.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('show');
    });
}

// -------------------------------
// Location Detection
// -------------------------------
function initLocationDetection() {
    const btn = $('getLocationBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!navigator.geolocation) return alert('Geolocation not supported');

        $('locationStatus') && ($('locationStatus').textContent = 'Detecting...');
        btn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            pos => {
                userLocation = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                };

                updateLocationStatus(true);
                btn.disabled = false;
                searchFreelancers();
            },
            () => {
                btn.disabled = false;
                updateLocationStatus(false);
            }
        );
    });
}

function updateLocationStatus(ok) {
    const status = $('locationStatus');
    const btn = $('getLocationBtn');

    if (!status || !btn) return;

    status.textContent = ok ? 'Location Set ✓' : 'Detect Location';
    btn.classList.toggle('active', ok);
}

// -------------------------------
// MAIN SEARCH (CRASH-PROOF)
// -------------------------------
async function searchFreelancers() {
    const resultsGrid = $('resultsGrid');
    if (!resultsGrid) return;

    const loadingState = $('loadingState');
    const noResults = $('noResults');
    const pagination = $('pagination');
    const resultsInfo = $('resultsInfo');

    resultsGrid.innerHTML = '';
    safeDisplay(loadingState, 'block');
    safeDisplay(noResults, 'none');
    safeDisplay(pagination, 'none');

    const params = new URLSearchParams();

    const profession = $('professionFilter')?.value;
    const radius = $('radiusFilter')?.value;

    if (profession && profession !== 'all') params.set('profession', profession);
    if (userLocation) {
        params.set('latitude', userLocation.latitude);
        params.set('longitude', userLocation.longitude);
        params.set('radius', radius || 10);
    }

    params.set('page', currentPage);
    params.set('limit', 12);

    try {
        const res = await fetch(`/api/freelancers/search?${params}`);
        const data = await res.json();

        safeDisplay(loadingState, 'none');

        if (!data.success || !data.data.length) {
            safeDisplay(noResults, 'block');
            resultsInfo && (resultsInfo.textContent = 'No results found');
            return;
        }

        displayResults(data.data);

        totalPages = data.pagination.pages || 1;
        if (pagination && totalPages > 1) {
            safeDisplay(pagination, 'flex');
            $('pageInfo') && ($('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`);
            $('prevPage') && ($('prevPage').disabled = currentPage === 1);
            $('nextPage') && ($('nextPage').disabled = currentPage === totalPages);
        }

        resultsInfo && (resultsInfo.textContent =
            `Found ${data.pagination.total} professional(s)`
        );

    } catch (err) {
        console.error(err);
        safeDisplay(loadingState, 'none');
        resultsGrid.innerHTML = `<p class="error-message">Failed to load results</p>`;
    }
}

// -------------------------------
// Render Cards
// -------------------------------
function displayResults(list) {
    const grid = $('resultsGrid');
    if (!grid) return;

    grid.innerHTML = list.map(f => `
        <div class="freelancer-card" onclick="showFreelancerDetail('${f._id}')">
            <div class="card-name">${escapeHtml(f.fullName)}</div>
            <div>₹${f.rupeesPerHour}/hr</div>
        </div>
    `).join('');
}

// -------------------------------
// Modal Detail
// -------------------------------
async function showFreelancerDetail(id) {
    const modal = $('freelancerModal');
    const detail = $('freelancerDetail');
    if (!modal || !detail) return;

    modal.classList.add('show');
    detail.innerHTML = 'Loading...';

    try {
        const res = await fetch(`/api/freelancers/${id}`);
        const data = await res.json();

        if (!data.success) throw 0;

        detail.innerHTML = `
            <h2>${escapeHtml(data.data.fullName)}</h2>
            <p>₹${data.data.rupeesPerHour}/hr</p>
        `;
    } catch {
        detail.innerHTML = 'Error loading profile';
    }
}

// -------------------------------
// Reset
// -------------------------------
function resetFilters() {
    $('professionFilter') && ($('professionFilter').value = 'all');
    $('radiusFilter') && ($('radiusFilter').value = '10');
    currentPage = 1;
    searchFreelancers();
}

// -------------------------------
// Utils
// -------------------------------
function escapeHtml(text = '') {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
