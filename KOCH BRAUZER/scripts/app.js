/* ============ KOCH BRAUZER v2.3.3 — единый модуль ============ */

/* ---------- 1. Browser API (Firefox first) ---------- */
const api = typeof browser !== 'undefined' ? browser : chrome;
const isExt = !!(api && api.runtime && api.runtime.id);

const apiStorage = {
    async get(keys) {
        if (!isExt) {
            const r = {}, ka = Array.isArray(keys) ? keys : [keys];
            for (const k of ka) {
                const raw = localStorage.getItem('kb_' + k);
                if (raw !== null) { try { r[k] = JSON.parse(raw); } catch { r[k] = raw; } }
            }
            return r;
        }
        return api.storage.local.get(keys);
    },
    async set(items) {
        if (!isExt) {
            for (const [k, v] of Object.entries(items)) localStorage.setItem('kb_' + k, JSON.stringify(v));
            return;
        }
        return api.storage.local.set(items);
    },
    async clear() {
        if (!isExt) {
            Object.keys(localStorage).forEach(k => { if (k.startsWith('kb_')) localStorage.removeItem(k); });
            return;
        }
        return api.storage.local.clear();
    },
    onChanged(cb) {
        if (!isExt) {
            window.addEventListener('storage', e => {
                if (!e.key || !e.key.startsWith('kb_')) return;
                let nv; try { nv = JSON.parse(e.newValue); } catch { nv = e.newValue; }
                cb({ [e.key.slice(3)]: { newValue: nv } }, 'local');
            });
            return;
        }
        api.storage.onChanged.addListener(cb);
    }
};

/* ---------- 2. Утилиты ---------- */
const $ = (s, c = document) => c.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class') n.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) {
        if (kid == null || kid === false) continue;
        n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return n;
}

const debounce = (fn, ms = 250) => {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
};

function toast(msg, type = 'info') {
    let box = document.getElementById('toasts');
    if (!box) { box = el('div', { id: 'toasts' }); document.body.append(box); }
    const t = el('div', { class: type === 'error' ? 'toast toast-error' : 'toast' }, msg);
    box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
}

function faviconOf(url) {
    try {
        const u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch { return ''; }
}

function normalizeUrl(str) {
    str = (str || '').trim();
    if (!str) return '';
    if (/^https?:\/\//i.test(str)) return str;
        if (str.includes('.') && !str.includes(' ')) return 'https://' + str;
            return '';
}

const readFileAsDataURL = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('read error'));
    r.readAsDataURL(f);
});

/* обёртка: ошибка настройки никогда не проходит молча */
const safe = fn => (...a) => {
    Promise.resolve(fn(...a)).catch(err => {
        console.error('[KOCH] setting error:', err);
        toast('Не удалось применить настройку', 'error');
    });
};

/* ---------- 3. Хранилище настроек ---------- */
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));

const DEFAULT_SETTINGS = {
    theme: 'rose',
    subtitle: 'твоя стартовая страница',
    cities: ['Воткинск', 'Уральск'],
    avatar: '',
    engine: 'google',
    bg: { type: 'none', url: '', idb: '', opacity: 100, blur: 0 },
    appearance: {
        panelOpacity: 72, cardOpacity: 100,
        radius: { card: 18, panel: 26, button: 10, chip: 12, input: 10 },
        font: { family: "'Product Sans','Product Sans Regular',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif", size: 16, weight: 400, lineHeight: 1.5 },
        animations: true, transitionSpeed: 0.28
    },
    language: 'ru'
};

const DEFAULT_CATEGORIES = [
    { id: 'c1', icon: '🌐', name: 'Соцсети', shortcuts: [
        { id: 's1', title: 'YouTube', url: 'https://youtube.com', icon: '' },
        { id: 's2', title: 'Telegram', url: 'https://web.telegram.org', icon: '' },
        { id: 's3', title: 'VK', url: 'https://vk.com', icon: '' },
        { id: 's4', title: 'Discord', url: 'https://discord.com', icon: '' }
    ]},
{ id: 'c2', icon: '🎵', name: 'Музыка', shortcuts: [
    { id: 's5', title: 'Spotify', url: 'https://open.spotify.com', icon: '' },
    { id: 's6', title: 'SoundCloud', url: 'https://soundcloud.com', icon: '' },
    { id: 's7', title: 'Я Музыка', url: 'https://music.yandex.ru', icon: '' }
]},
{ id: 'c3', icon: '🎮', name: 'Игры', shortcuts: [
    { id: 's8', title: 'Steam', url: 'https://steampowered.com', icon: '' },
    { id: 's9', title: 'Twitch', url: 'https://twitch.tv', icon: '' },
    { id: 's10', title: 'Epic Games', url: 'https://store.epicgames.com', icon: '' }
]},
{ id: 'c4', icon: '💻', name: 'Разработка', shortcuts: [
    { id: 's11', title: 'GitHub', url: 'https://github.com', icon: '' },
    { id: 's12', title: 'StackOverflow', url: 'https://stackoverflow.com', icon: '' },
    { id: 's13', title: 'Reddit', url: 'https://reddit.com', icon: '' }
]}
];

const CURRENT_SCHEMA = 2;
let settingsCache = null;

function deepMerge(t, s) {
    const r = { ...t };
    for (const k in s) {
        if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) r[k] = deepMerge(t[k] || {}, s[k]);
        else r[k] = s[k];
    }
    return r;
}

function migrate(old) {
    if (!old) return clone(DEFAULT_SETTINGS);
    const m = clone(DEFAULT_SETTINGS);
    if (old.theme) m.theme = old.theme;
    if (old.subtitle !== undefined) m.subtitle = old.subtitle;
    if (old.cities) m.cities = old.cities;
    if (old.avatar !== undefined) m.avatar = old.avatar;
    if (old.engine) m.engine = old.engine;
    if (old.bg) m.bg = { ...DEFAULT_SETTINGS.bg, ...old.bg };
    if (old.animations !== undefined) m.appearance.animations = old.animations;
    return m;
}

const store = {
    async getSettings() {
        if (settingsCache) return clone(settingsCache);
        const data = await apiStorage.get(['settings', 'schemaVersion']);
        let s = data.settings;
        if ((data.schemaVersion || 1) < CURRENT_SCHEMA || !s) {
            s = migrate(s);
            await this.setSettings(s, false);
            await apiStorage.set({ schemaVersion: CURRENT_SCHEMA });
        }
        s = deepMerge(clone(DEFAULT_SETTINGS), s);
        settingsCache = s;
        return clone(s);
    },
    async setSettings(s, inv = true) { if (inv) settingsCache = null; await apiStorage.set({ settings: s }); },
    async updateSettings(fn) {
        const cur = await this.getSettings();
        const merged = deepMerge(clone(DEFAULT_SETTINGS), fn(clone(cur)));
        await this.setSettings(merged);
        return merged;
    },
    async getCategories() { const d = await apiStorage.get('categories'); return d.categories || clone(DEFAULT_CATEGORIES); },
    async setCategories(c) { await apiStorage.set({ categories: c }); },
    async getHistory() { const d = await apiStorage.get('history'); return d.history || []; },
    async setHistory(h) { await apiStorage.set({ history: h }); },
    onSettingsChange(cb) {
        apiStorage.onChanged((changes, area) => {
            if (area === 'local' && changes.settings) { settingsCache = null; cb(changes.settings.newValue); }
        });
    },
    onCategoriesChange(cb) {
        apiStorage.onChanged((changes, area) => {
            if (area === 'local' && changes.categories) cb(changes.categories.newValue);
        });
    },
    async reset() { settingsCache = null; await apiStorage.clear(); },
    async exportAll() { return JSON.stringify(await apiStorage.get(['settings', 'categories', 'history', 'schemaVersion']), null, 2); },
    async importAll(json) {
        const d = JSON.parse(json);
        if (d.settings) d.settings = migrate(d.settings);
        await apiStorage.set(d);
        settingsCache = null;
    }
};

/* ---------- 4. Медиа-хранилище (IndexedDB, без base64 и лимитов) ---------- */
const MEDIA_KEY = 'bg-media';
let idbPromise = null;

function openMediaDB() {
    if (!idbPromise) {
        idbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('koch-brauzer-media', 1);
            req.onupgradeneeded = () => { req.result.createObjectStore('media'); };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return idbPromise;
}

async function mediaPut(key, blob) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function mediaGet(key) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('media', 'readonly');
        const rq = tx.objectStore('media').get(key);
        rq.onsuccess = () => resolve(rq.result || null);
        rq.onerror = () => reject(rq.error);
    });
}

async function mediaDel(key) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/* ---------- 5. Темы и внешний вид ---------- */
const THEMES = {
    rose: 'Розовая', purple: 'Фиолетовая', ocean: 'Океан', green: 'Изумруд',
    dark: 'Тёмная', light: 'Светлая', midnight: 'Полночь', sunset: 'Закат'
};

let appliedTheme = null, applying = false, bgObjectUrl = null;

async function applyTheme(id, persist = true) {
    if (applying) return;
    applying = true;
    try {
        if (!THEMES[id]) id = 'rose';
        if (id === appliedTheme && !persist) { applying = false; return; }
        appliedTheme = id;
        document.body.dataset.theme = id;
        if (persist) await store.updateSettings(s => ({ ...s, theme: id }));
    } finally { applying = false; }
}

function applyAppearance(app) {
    if (!app) return;
    const r = document.documentElement;
    r.style.setProperty('--panel-opacity', (app.panelOpacity ?? 72) / 100);
    r.style.setProperty('--card-opacity', (app.cardOpacity ?? 100) / 100);
    if (app.radius) {
        r.style.setProperty('--radius-card', (app.radius.card ?? 18) + 'px');
        r.style.setProperty('--radius-panel', (app.radius.panel ?? 26) + 'px');
        r.style.setProperty('--radius-button', (app.radius.button ?? 10) + 'px');
        r.style.setProperty('--radius-chip', (app.radius.chip ?? 12) + 'px');
        r.style.setProperty('--radius-input', (app.radius.input ?? 10) + 'px');
    }
    if (app.font) {
        r.style.setProperty('--font-family', app.font.family || DEFAULT_SETTINGS.appearance.font.family);
        r.style.setProperty('--font-size', (app.font.size ?? 16) + 'px');
        r.style.setProperty('--font-weight', app.font.weight ?? 400);
        r.style.setProperty('--line-height', app.font.lineHeight ?? 1.5);
    }
    r.style.setProperty('--transition-speed', (app.transitionSpeed ?? 0.28) + 's');
    r.classList.toggle('reduce-motion', app.animations === false);
}

async function applyBackground(preloaded) {
    const s = preloaded || await store.getSettings();
    const bg = s.bg || { type: 'none', url: '', idb: '' };
    const v = document.getElementById('bg-video');
    const i = document.getElementById('bg-image');
    const o = document.getElementById('bg-orbs');
    if (!v || !i || !o) return;

    let url = (bg.type !== 'none') ? (bg.url || '') : '';
    if (bg.type !== 'none' && bg.idb) {
        const blob = await mediaGet(bg.idb).catch(err => { console.warn('[KOCH] media read:', err); return null; });
        if (blob) url = URL.createObjectURL(blob);
    }
    if (bgObjectUrl && bgObjectUrl !== url) URL.revokeObjectURL(bgObjectUrl);
    bgObjectUrl = (url && url.startsWith('blob:')) ? url : null;

    const op = (bg.opacity ?? 100) / 100;
    const bl = bg.blur || 0;
    const filt = bl > 0 ? `blur(${bl}px)` : 'none';
    document.documentElement.style.setProperty('--bg-opacity', op);

    if (bg.type === 'video' && url) {
        i.hidden = true; o.hidden = true; v.hidden = false;
        v.style.opacity = op; v.style.filter = filt;
        if (v.src !== url && v.dataset.kbUrl !== url) {
            v.dataset.kbUrl = url;
            v.src = url;
            v.play().catch(() => {});
        }
    } else if (bg.type === 'image' && url) {
        v.hidden = true; v.pause(); o.hidden = true; i.hidden = false;
        i.style.backgroundImage = `url("${url}")`; i.style.opacity = op; i.style.filter = filt;
    } else {
        v.hidden = true; v.pause(); v.removeAttribute('src'); v.dataset.kbUrl = '';
        i.hidden = true; i.style.backgroundImage = '';
        o.hidden = false;
    }
}

/* ремонт старого состояния: гигантский data-URL фона -> IndexedDB */
async function repairBgMedia(s) {
    const bg = s.bg || {};
    if (bg.url && bg.url.startsWith('data:') && bg.url.length > 200000) {
        try {
            const blob = await (await fetch(bg.url)).blob();
            await mediaPut(MEDIA_KEY, blob);
            const fixed = { ...DEFAULT_SETTINGS.bg, ...bg, url: '', idb: MEDIA_KEY };
            await store.updateSettings(st => ({ ...st, bg: fixed }));
            return fixed;
        } catch (err) {
            console.warn('[KOCH] bg repair failed:', err);
            const fixed = { ...DEFAULT_SETTINGS.bg, ...bg, url: '', idb: '' };
            await store.updateSettings(st => ({ ...st, bg: fixed }));
            return fixed;
        }
    }
    return bg;
}

/* ---------- 6. Часы и погода ---------- */
const geoCache = new Map();
let tickTimer = null, wxTimer = null, clockSlots = [];

async function geocode(city) {
    if (!city || city === '—') return null;
    if (geoCache.has(city)) return geoCache.get(city);
    try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`);
        const d = await r.json();
        const g = d?.results?.[0];
        const info = g ? { lat: g.latitude, lon: g.longitude, tz: g.timezone || null } : null;
        geoCache.set(city, info);
        return info;
    } catch { geoCache.set(city, null); return null; }
}

async function weather(lat, lon) {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
    const d = await r.json();
    return { t: Math.round(d.current.temperature_2m), code: d.current.weather_code };
}

function wxEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌦️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '❄️';
    return '⛈️';
}

function tick() {
    const now = new Date();
    clockSlots.forEach((s, i) => {
        const elT = $(i === 0 ? '#time-a' : '#time-b'); if (!elT) return;
        try {
            elT.textContent = new Intl.DateTimeFormat('ru-RU', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: s.tz || undefined
            }).format(now);
        } catch { elT.textContent = now.toLocaleTimeString('ru-RU'); }
    });
}

async function refreshWeather() {
    for (let i = 0; i < clockSlots.length; i++) {
        const s = clockSlots[i], wxEl = $(i === 0 ? '#wx-a' : '#wx-b');
        if (!wxEl) continue;
        if (!s?.geo) { wxEl.textContent = '—'; continue; }
        try {
            const w = await weather(s.geo.lat, s.geo.lon);
            wxEl.textContent = `${w.t > 0 ? '+' : ''}${w.t}°C ${wxEmoji(w.code)}`;
        } catch { wxEl.textContent = '—'; }
    }
}

async function initClocks(preloaded) {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (wxTimer) { clearInterval(wxTimer); wxTimer = null; }
    const s = preloaded || await store.getSettings();
    const cities = s.cities || ['—', '—'];
    clockSlots = [0, 1].map(i => {
        const city = cities[i] || '—';
        const nameEl = $(i === 0 ? '#city-a' : '#city-b');
        if (nameEl) nameEl.textContent = String(city).toUpperCase();
        return { city, tz: null, geo: null };
    });
    tick();
    tickTimer = setInterval(tick, 1000);
    (async () => {
        await Promise.all(clockSlots.map(async sl => {
            sl.geo = await geocode(sl.city);
            sl.tz = sl.geo?.tz || null;
        }));
        tick();
        refreshWeather();
        wxTimer = setInterval(refreshWeather, 30 * 60 * 1000);
    })();
}

/* ---------- 7. Поиск ---------- */
const ENGINES = {
    google: { label: 'G', name: 'Google', url: 'https://www.google.com/search?q=' },
    ddg: { label: 'DD', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    bing: { label: 'B', name: 'Bing', url: 'https://www.bing.com/search?q=' },
    yandex: { label: 'Я', name: 'Яндекс', url: 'https://yandex.ru/search/?text=' },
    brave: { label: 'BS', name: 'Brave Search', url: 'https://search.brave.com/search?q=' }
};

let engine = 'google', qHistory = [];
const searchInput = () => $('#search-input');
const suggestBox = () => $('#suggest');
const suggestList = () => $('#suggest-list');

function paintEngine() {
    const btn = $('#engine-btn'); if (!btn) return;
    btn.textContent = ENGINES[engine].label;
    btn.title = 'Поисковик: ' + ENGINES[engine].name;
    const inp = searchInput(); if (inp) inp.placeholder = `Поиск в ${ENGINES[engine].name}…`;
}

function renderSuggest() {
    const box = suggestBox(), ul = suggestList(), inp = searchInput();
    if (!box || !ul || !inp) return;
    const q = inp.value.trim().toLowerCase();
    const items = qHistory.filter(h => !q || h.q.toLowerCase().includes(q)).slice(0, 8);
    ul.innerHTML = '';
    items.forEach(h => {
        ul.append(el('li', { onclick: () => { inp.value = h.q; goSearch(); } },
                     el('span', {}, '🕒'), el('span', { class: 'q' }, h.q),
                     el('button', { class: 'del', onclick: e => {
                         e.stopPropagation();
                         qHistory = qHistory.filter(x => x.id !== h.id);
                         store.setHistory(qHistory); renderSuggest();
                     } }, '✕')
        ));
    });
    box.hidden = items.length === 0;
}

function hideSuggest() { const b = suggestBox(); if (b) b.hidden = true; }

async function goSearch() {
    const inp = searchInput(); if (!inp) return;
    const raw = inp.value.trim(); if (!raw) return;
    const asUrl = normalizeUrl(raw);
    const isUrl = /^https?:\/\//i.test(raw) || (asUrl !== '' && !raw.includes(' '));
    if (!isUrl) {
        qHistory = [{ id: String(Date.now()), q: raw }, ...qHistory.filter(h => h.q !== raw)].slice(0, 50);
        await store.setHistory(qHistory);
    }
    hideSuggest();
    location.href = isUrl ? asUrl : ENGINES[engine].url + encodeURIComponent(raw);
}

async function initSearch(preloaded) {
    const s = preloaded || await store.getSettings();
    engine = ENGINES[s.engine] ? s.engine : 'google';
    qHistory = await store.getHistory();
    paintEngine();
    $('#engine-btn')?.addEventListener('click', () => {
        const keys = Object.keys(ENGINES);
        engine = keys[(keys.indexOf(engine) + 1) % keys.length];
        store.updateSettings(st => ({ ...st, engine }));
        paintEngine();
    });
    searchInput()?.addEventListener('input', debounce(renderSuggest, 90));
    searchInput()?.addEventListener('focus', renderSuggest);
    searchInput()?.addEventListener('keydown', e => { if (e.key === 'Enter') goSearch(); if (e.key === 'Escape') hideSuggest(); });
    $('#search-go')?.addEventListener('click', goSearch);
    $('#clear-history')?.addEventListener('click', async () => { qHistory = []; await store.setHistory([]); renderSuggest(); });
    document.addEventListener('click', e => { if (!e.target.closest('.search-row')) hideSuggest(); });
}

/* ---------- 8. Категории и ярлыки ---------- */
let categories = [];
let scModal = { catId: null, scId: null };

async function renderCats() {
    categories = await store.getCategories();
    const wrap = $('#cats'); if (!wrap) return;
    wrap.innerHTML = '';
    categories.forEach((cat, ci) => wrap.append(buildCard(cat, ci)));
}

function buildCard(cat, ci) {
    const card = el('div', { class: 'cat-card' });
    card.style.animationDelay = `${0.42 + ci * 0.07}s`;
    const head = el('div', { class: 'cat-head', draggable: true },
                    el('span', { class: 'cat-ico' }, cat.icon || '📁'),
                    el('span', { class: 'cat-name' }, cat.name),
                    el('button', { class: 'cat-add', onclick: e => { e.stopPropagation(); openScModal(cat.id, null); } }, '＋')
    );
    head.addEventListener('contextmenu', e => {
        e.preventDefault();
        const action = prompt(`Категория «${cat.name}»:\n1 — переименовать\n2 — удалить`, '1');
        if (action === '1') {
            const name = prompt('Новое название:', cat.name);
            if (name?.trim()) { cat.name = name.trim().toUpperCase(); saveCats(); }
        } else if (action === '2' && confirm(`Удалить категорию «${cat.name}»?`)) {
            categories = categories.filter(c => c.id !== cat.id);
            saveCats(); toast('Категория удалена');
        }
    });
    head.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'cat', id: cat.id }));
        e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('drag-over');
        let data; try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
        if (data.type === 'chip') moveChip(data.catId, data.id, cat.id);
        else if (data.type === 'cat' && data.id !== cat.id) moveCat(data.id, cat.id);
    });
        const chips = el('div', { class: 'chips' });
        (cat.shortcuts || []).forEach((sc, si) => chips.append(buildChip(cat, sc, si)));
        card.append(head, chips);
        return card;
}

function buildChip(cat, sc, si) {
    const chip = el('div', { class: 'chip', draggable: true,
        onclick: () => { const u = normalizeUrl(sc.url); if (u) location.href = u; } });
    chip.style.animationDelay = `${si * 0.05}s`;
    let ico;
    if (sc.icon && (/^https?:/.test(sc.icon) || sc.icon.startsWith('data:')))
        ico = el('img', { src: sc.icon, alt: '', onerror: e => e.target.replaceWith(el('span', {}, '🌐')) });
    else if (sc.icon) ico = el('span', {}, sc.icon);
    else ico = el('img', { src: faviconOf(sc.url), alt: '', onerror: e => e.target.replaceWith(el('span', {}, '🌐')) });
    chip.append(
        el('div', { class: 'chip-tools' },
           el('button', { onclick: e => { e.stopPropagation(); openScModal(cat.id, sc.id); } }, '✎'),
           el('button', { onclick: e => {
               e.stopPropagation();
               cat.shortcuts = cat.shortcuts.filter(x => x.id !== sc.id);
               saveCats(); toast('Ярлык удалён');
           } }, '✕')
        ),
        el('div', { class: 'chip-ico' }, ico),
                el('div', { class: 'chip-name', title: sc.title }, sc.title)
    );
    chip.addEventListener('dragstart', e => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chip', catId: cat.id, id: sc.id }));
        e.dataTransfer.effectAllowed = 'move';
        chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    return chip;
}

async function saveCats() { await store.setCategories(categories); renderCats(); }

function moveChip(from, scId, to) {
    const s = categories.find(c => c.id === from), d = categories.find(c => c.id === to);
    if (!s || !d || from === to) return;
    const idx = s.shortcuts.findIndex(x => x.id === scId);
    if (idx === -1) return;
    const [sc] = s.shortcuts.splice(idx, 1); d.shortcuts.push(sc); saveCats();
}

function moveCat(dragId, targetId) {
    const from = categories.findIndex(c => c.id === dragId), to = categories.findIndex(c => c.id === targetId);
    if (from === -1 || to === -1) return;
    const [c] = categories.splice(from, 1); categories.splice(to, 0, c); saveCats();
}

function openScModal(catId, scId) {
    scModal = { catId, scId };
    const cat = categories.find(c => c.id === catId);
    const sc = cat?.shortcuts?.find(x => x.id === scId);
    const name = $('#sc-name'), url = $('#sc-url'), icon = $('#sc-icon');
    if (name) name.value = sc?.title || '';
    if (url) url.value = sc?.url || '';
    if (icon) icon.value = sc?.icon || '';
    const h = $('#sc-modal-heading'); if (h) h.textContent = sc ? 'Изменить ярлык' : 'Новый ярлык';
    const d = $('#sc-delete'); if (d) d.style.display = sc ? '' : 'none';
    const m = $('#sc-modal'); if (m) m.hidden = false;
}

function closeScModal() { const m = $('#sc-modal'); if (m) m.hidden = true; scModal = { catId: null, scId: null }; }

function bindScModal() {
    const form = $('#sc-form'); if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const cat = categories.find(c => c.id === scModal.catId); if (!cat) return;
        const data = {
            title: ($('#sc-name')?.value || '').trim(),
                          url: normalizeUrl($('#sc-url')?.value) || (($('#sc-url')?.value || '').trim()),
                          icon: ($('#sc-icon')?.value || '').trim()
        };
        if (!data.title || !data.url) return;
                          if (scModal.scId) {
                              const sc = cat.shortcuts.find(x => x.id === scModal.scId);
                              if (sc) Object.assign(sc, data);
                          toast('Ярлык обновлён');
                          } else {
                              cat.shortcuts.push({ id: uid(), ...data });
                              toast('Ярлык добавлен');
                          }
                          closeScModal(); saveCats();
    });
    $('#sc-delete')?.addEventListener('click', () => {
        const cat = categories.find(c => c.id === scModal.catId);
        if (cat) cat.shortcuts = cat.shortcuts.filter(x => x.id !== scModal.scId);
        closeScModal(); saveCats(); toast('Ярлык удалён');
    });
}

function bindAddCat() {
    $('#add-cat')?.addEventListener('click', async () => {
        const name = prompt('Название новой категории:');
        if (!name?.trim()) return;
        const icons = ['📁', '', '', '🎮', '💻', '📚', '', '🛒'];
        categories.push({ id: uid(), icon: icons[Math.floor(Math.random() * icons.length)], name: name.trim().toUpperCase(), shortcuts: [] });
        await saveCats(); toast('Категория добавлена');
    });
}

/* ---------- 9. Настройки ---------- */
let currentSettings = null;

const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); return e; };
const val = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
const txt = (id, s) => { const e = document.getElementById(id); if (e) e.textContent = s; };

async function ensureSettings() { if (!currentSettings) currentSettings = await store.getSettings(); }

function downscaleImage(file, max = 256) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, max / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/png'));
            } catch (err) { reject(err); }
            finally { URL.revokeObjectURL(url); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode error')); };
        img.src = url;
    });
}

async function updateSetting(key, valueOrFn) {
    await ensureSettings();
    const v = typeof valueOrFn === 'function' ? valueOrFn(currentSettings[key]) : valueOrFn;
    currentSettings = await store.updateSettings(s => ({ ...s, [key]: v }));
}

async function updateAppearanceSetting(key, valueOrFn) {
    await ensureSettings();
    const cur = currentSettings.appearance || {};
    const v = typeof valueOrFn === 'function' ? valueOrFn(cur[key]) : valueOrFn;
    currentSettings = await store.updateSettings(s => ({ ...s, appearance: { ...s.appearance, [key]: v } }));
    applyAppearance(currentSettings.appearance);
}

function bindSlider(inputId, path, valueId, suffix, step = 1) {
    on(inputId, 'input', debounce(safe(e => {
        const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        txt(valueId, v + suffix);
        const parts = path.split('.');
        if (parts.length === 1) updateAppearanceSetting(parts[0], v);
        else updateAppearanceSetting(parts[0], prev => ({ ...prev, [parts[1]]: v }));
    }), 100));
}

function paintAvatar(url) {
    const img = document.getElementById('avatar-img'), fb = document.getElementById('avatar-fallback');
    if (!img || !fb) return;
    if (url) { img.src = url; img.hidden = false; fb.hidden = true; }
    else { img.hidden = true; fb.hidden = false; }
}

function bindSettings() {
    on('settings-btn', 'click', safe(openSettings));
    document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', e => { if (e.target === ov) ov.hidden = true; });
    });
    document.querySelectorAll('[data-close]').forEach(b => {
        b.addEventListener('click', () => { const t = document.getElementById(b.getAttribute('data-close')); if (t) t.hidden = true; });
    });

    on('set-subtitle', 'input', debounce(safe(async e => {
        await updateSetting('subtitle', e.target.value);
        txt('subtitle', e.target.value);
    }), 300));

    const cityHandler = idx => debounce(safe(async e => {
        await updateSetting('cities', prev => { const c = (prev || []).slice(); c[idx] = e.target.value; return c; });
        initClocks();
    }), 500);
    on('set-city-a', 'input', cityHandler(0));
    on('set-city-b', 'input', cityHandler(1));

    on('set-avatar', 'change', safe(async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const url = await downscaleImage(f, 256);
            await updateSetting('avatar', url);
            paintAvatar(url); toast('Аватар обновлён');
        } catch (err) {
            toast('Не удалось прочитать файл', 'error');
        }
        e.target.value = '';
    }));
    on('reset-avatar', 'click', safe(async () => {
        await updateSetting('avatar', ''); paintAvatar(''); toast('Аватар сброшен');
    }));

    on('set-bg-type', 'change', safe(async e => {
        await updateSetting('bg', prev => ({ ...prev, type: e.target.value }));
        await applyBackground();
    }));
    on('set-bg-file', 'change', safe(async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const type = f.type.indexOf('video') === 0 ? 'video' : 'image';
            await mediaPut(MEDIA_KEY, f);                       // blob в IndexedDB, без base64
            await updateSetting('bg', prev => ({ ...prev, type, url: '', idb: MEDIA_KEY }));
            val('set-bg-type', type); val('set-bg-url', '');
            await applyBackground(); toast('Фон обновлён');
        } catch (err) {
            console.error('[KOCH] bg save:', err);
            toast('Не удалось сохранить файл фона', 'error');
        }
        e.target.value = '';
    }));
    on('set-bg-url', 'change', safe(async e => {
        const u = e.target.value.trim();
        await updateSetting('bg', prev => ({ ...prev, url: u, idb: '' }));
        if (u) mediaDel(MEDIA_KEY).catch(err => console.warn('[KOCH] media del:', err));
        await applyBackground(); toast('Фон обновлён');
    }));
    on('set-bg-opacity', 'input', debounce(safe(async e => {
        const v = parseInt(e.target.value, 10);
        txt('set-bg-opacity-val', v + '%');
        await updateSetting('bg', prev => ({ ...prev, opacity: v }));
        await applyBackground();
    }), 100));
    on('set-bg-blur', 'input', debounce(safe(async e => {
        const v = parseInt(e.target.value, 10);
        txt('set-bg-blur-val', v + 'px');
        await updateSetting('bg', prev => ({ ...prev, blur: v }));
        await applyBackground();
    }), 100));

    bindSlider('set-panel-opacity', 'panelOpacity', 'set-panel-opacity-val', '%');
    bindSlider('set-card-opacity', 'cardOpacity', 'set-card-opacity-val', '%');
    bindSlider('set-radius-panel', 'radius.panel', 'set-radius-panel-val', 'px');
    bindSlider('set-radius-card', 'radius.card', 'set-radius-card-val', 'px');
    bindSlider('set-radius-button', 'radius.button', 'set-radius-button-val', 'px');
    bindSlider('set-radius-chip', 'radius.chip', 'set-radius-chip-val', 'px');
    bindSlider('set-radius-input', 'radius.input', 'set-radius-input-val', 'px');
    on('set-font-family', 'change', safe(e => updateAppearanceSetting('font', prev => ({ ...prev, family: e.target.value }))));
    bindSlider('set-font-size', 'font.size', 'set-font-size-val', 'px');
    bindSlider('set-font-weight', 'font.weight', 'set-font-weight-val', '');
    bindSlider('set-line-height', 'font.lineHeight', 'set-line-height-val', '', 0.1);
    on('set-animations', 'change', safe(e => updateAppearanceSetting('animations', e.target.checked)));
    bindSlider('set-transition-speed', 'transitionSpeed', 'set-transition-speed-val', 's', 0.01);

    on('export-btn', 'click', safe(async () => {
        const blob = new Blob([await store.exportAll()], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'koch-brauzer-backup.json'; a.click(); URL.revokeObjectURL(a.href);
        toast('Экспортировано');
    }));
    on('import-btn', 'change', safe(async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            await store.importAll(await f.text());
            toast('Импортировано, перезагрузка…');
            setTimeout(() => location.reload(), 800);
        } catch { toast('Ошибка импорта', 'error'); }
        e.target.value = '';
    }));
    on('reset-btn', 'click', safe(async () => {
        if (confirm('Сбросить все настройки и данные?')) { await store.reset(); location.reload(); }
    }));
}

function setSlider(inputId, value, valueId, suffix) { val(inputId, value); txt(valueId, value + suffix); }

async function openSettings() {
    currentSettings = await store.getSettings();
    val('set-subtitle', currentSettings.subtitle || '');
    val('set-city-a', currentSettings.cities?.[0] || '');
    val('set-city-b', currentSettings.cities?.[1] || '');

    const bg = currentSettings.bg || {};
    val('set-bg-type', bg.type || 'none');
    val('set-bg-url', bg.url || '');
    val('set-bg-opacity', bg.opacity ?? 100); txt('set-bg-opacity-val', (bg.opacity ?? 100) + '%');
    val('set-bg-blur', bg.blur || 0); txt('set-bg-blur-val', (bg.blur || 0) + 'px');

    const app = currentSettings.appearance || {};
    val('set-panel-opacity', app.panelOpacity ?? 72); txt('set-panel-opacity-val', (app.panelOpacity ?? 72) + '%');
    val('set-card-opacity', app.cardOpacity ?? 100); txt('set-card-opacity-val', (app.cardOpacity ?? 100) + '%');

    const r = app.radius || {};
    setSlider('set-radius-panel', r.panel ?? 26, 'set-radius-panel-val', 'px');
    setSlider('set-radius-card', r.card ?? 18, 'set-radius-card-val', 'px');
    setSlider('set-radius-button', r.button ?? 10, 'set-radius-button-val', 'px');
    setSlider('set-radius-chip', r.chip ?? 12, 'set-radius-chip-val', 'px');
    setSlider('set-radius-input', r.input ?? 10, 'set-radius-input-val', 'px');

    const f = app.font || {};
    const fam = $('#set-font-family');
    if (fam) fam.value = f.family || DEFAULT_SETTINGS.appearance.font.family;
    setSlider('set-font-size', f.size ?? 16, 'set-font-size-val', 'px');
    setSlider('set-font-weight', f.weight ?? 400, 'set-font-weight-val', '');
    setSlider('set-line-height', f.lineHeight ?? 1.5, 'set-line-height-val', '');

    const anim = document.getElementById('set-animations');
    if (anim) anim.checked = app.animations !== false;
    setSlider('set-transition-speed', app.transitionSpeed ?? 0.28, 'set-transition-speed-val', 's');

    const ov = document.getElementById('settings-overlay');
    if (ov) ov.hidden = false;
}

/* ---------- 10. Запуск ---------- */
window.addEventListener('error', e => {
    console.error('[KOCH] Error:', e.error || e.message);
    toast('Ошибка — смотри консоль (F12)', 'error');
});
window.addEventListener('unhandledrejection', e => console.error('[KOCH] Rejection:', e.reason));

function initThemeSelector(cur) {
    const sel = $('#theme-select'); if (!sel) return;
    sel.innerHTML = '';
    Object.keys(THEMES).forEach(id => {
        const o = document.createElement('option');
        o.value = id; o.textContent = THEMES[id];
        if (id === cur) o.selected = true;
        sel.append(o);
    });
    sel.addEventListener('change', () => applyTheme(sel.value, true));
}

function bindKeys() {
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput()?.focus(); }
        if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); const ov = $('#settings-overlay'); if (ov) ov.hidden = false; }
        if (e.key === 'Escape') { const ov = $('#settings-overlay'); if (ov) ov.hidden = true; closeScModal(); }
    });
}

async function boot() {
    const start = performance.now();
    try {
        const s = await store.getSettings();
        s.bg = await repairBgMedia(s);          // чиним старый раздутый фон, если есть
        await applyTheme(s.theme, false);
        applyAppearance(s.appearance);
        await applyBackground(s);
        const sub = $('#subtitle'); if (sub) sub.textContent = s.subtitle || '';
        paintAvatar(s.avatar || '');
        initThemeSelector(s.theme);

        initClocks(s);
        await Promise.all([initSearch(s), renderCats()]);
        bindAddCat(); bindScModal(); bindSettings(); bindKeys();

        let lastCities = JSON.stringify(s.cities || []);
        const sync = debounce(async next => {
            if (!next) return;
            await applyTheme(next.theme, false);
            applyAppearance(next.appearance);
            await applyBackground(next);
            if (sub) sub.textContent = next.subtitle || '';
            paintAvatar(next.avatar || '');
            const c = JSON.stringify(next.cities || []);
            if (c !== lastCities) { lastCities = c; initClocks(next); }
        }, 120);
        store.onSettingsChange(sync);
        store.onCategoriesChange(renderCats);

        console.info(`[KOCH] Загружено за ${Math.round(performance.now() - start)}ms`);
    } catch (err) {
        console.error('[KOCH] Boot error:', err);
        toast('Ошибка инициализации', 'error');
    }
}

boot();
