
/* ---------- 1. Browser API ---------- */
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
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const num = (v, def, min, max) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
};

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

/* ---------- 3. Цвет: HEX <-> HSL ---------- */
function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
    const to2 = x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    return '#' + to2(r) + to2(g) + to2(b);
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return { r: hue2rgb(p, q, h + 1 / 3) * 255, g: hue2rgb(p, q, h) * 255, b: hue2rgb(p, q, h - 1 / 3) * 255 };
}

const hslHex = (h, s, l) => { const { r, g, b } = hslToRgb(h, s, l); return rgbToHex(r, g, b); };
const rgbaOf = (hex, a) => { const { r, g, b } = hexToRgb(hex); return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`; };

/* ---------- 4. Хранилище ---------- */
const DEFAULT_SETTINGS = {
    theme: 'rose',
    customColor: '#ff4fa3',
    title: 'KOCH BRAUZER',
    subtitle: 'твоя стартовая страница',
    cities: ['Воткинск', 'Уральск'],
    avatar: '',
    engine: 'google',
    bg: { type: 'none', url: '', idb: '', opacity: 100, blur: 0 },
    appearance: {
        panelOpacity: 72, cardOpacity: 100,
        panelBlur: 0, cardBlur: 0,
        radius: { card: 18, panel: 26, button: 10, chip: 12, input: 10 },
        font: { family: "'Product Sans','Product Sans Regular',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif", size: 16, weight: 400, lineHeight: 1.5 },
        animations: true, transitionSpeed: 0.28
    },
    language: 'ru'
};

const DEFAULT_CATEGORIES = [
    { id: 'c1', icon: '🌐', image: '', name: 'Соцсети', shortcuts: [
        { id: 's1', title: 'YouTube', url: 'https://youtube.com', icon: '' },
        { id: 's2', title: 'Telegram', url: 'https://web.telegram.org', icon: '' },
        { id: 's3', title: 'VK', url: 'https://vk.com', icon: '' },
        { id: 's4', title: 'Discord', url: 'https://discord.com', icon: '' }
    ]},
{ id: 'c2', icon: '🎵', image: '', name: 'Музыка', shortcuts: [
    { id: 's5', title: 'Spotify', url: 'https://open.spotify.com', icon: '' },
    { id: 's6', title: 'SoundCloud', url: 'https://soundcloud.com', icon: '' },
    { id: 's7', title: 'Я Музыка', url: 'https://music.yandex.ru', icon: '' }
]},
{ id: 'c3', icon: '🎮', image: '', name: 'Игры', shortcuts: [
    { id: 's8', title: 'Steam', url: 'https://steampowered.com', icon: '' },
    { id: 's9', title: 'Twitch', url: 'https://twitch.tv', icon: '' },
    { id: 's10', title: 'Epic Games', url: 'https://store.epicgames.com', icon: '' }
]},
{ id: 'c4', icon: '💻', image: '', name: 'Разработка', shortcuts: [
    { id: 's11', title: 'GitHub', url: 'https://github.com', icon: '' },
    { id: 's12', title: 'StackOverflow', url: 'https://stackoverflow.com', icon: '' },
    { id: 's13', title: 'Reddit', url: 'https://reddit.com', icon: '' }
]}
];

const CURRENT_SCHEMA = 3;
const PROFILE_FORMAT_VERSION = 3;
const MEDIA_KEY = 'bg-media';
let settingsCache = null;

function deepMerge(t, s) {
    const r = { ...t };
    for (const k in s) {
        if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) r[k] = deepMerge(t[k] || {}, s[k]);
        else r[k] = s[k];
    }
    return r;
}

/* ---------- 5. Нормализация и миграция ---------- */
function normalizeBg(bg) {
    bg = bg && typeof bg === 'object' ? bg : {};
    return {
        type: ['none', 'image', 'video'].includes(bg.type) ? bg.type : 'none',
        url: typeof bg.url === 'string' ? bg.url : '',
        idb: typeof bg.idb === 'string' ? bg.idb : '',
        opacity: num(bg.opacity, 100, 0, 100),
        blur: num(bg.blur, 0, 0, 20)
    };
}

function normalizeAppearance(app) {
    app = app && typeof app === 'object' ? app : {};
    const d = DEFAULT_SETTINGS.appearance;
    const r = app.radius && typeof app.radius === 'object' ? app.radius : {};
    const f = app.font && typeof app.font === 'object' ? app.font : {};
    return {
        panelOpacity: num(app.panelOpacity, d.panelOpacity, 0, 100),
        cardOpacity: num(app.cardOpacity, d.cardOpacity, 0, 100),
        panelBlur: num(app.panelBlur, 0, 0, 20),
        cardBlur: num(app.cardBlur, 0, 0, 20),
        radius: {
            card: num(r.card, d.radius.card, 0, 50),
            panel: num(r.panel, d.radius.panel, 0, 50),
            button: num(r.button, d.radius.button, 0, 50),
            chip: num(r.chip, d.radius.chip, 0, 50),
            input: num(r.input, d.radius.input, 0, 50)
        },
        font: {
            family: typeof f.family === 'string' && f.family ? f.family : d.font.family,
            size: num(f.size, d.font.size, 10, 32),
            weight: num(f.weight, d.font.weight, 100, 900),
            lineHeight: num(f.lineHeight, d.font.lineHeight, 1, 3)
        },
        animations: typeof app.animations === 'boolean' ? app.animations : true,
        transitionSpeed: num(app.transitionSpeed, d.transitionSpeed, 0, 2)
    };
}

function normalizeSettings(s) {
    s = s && typeof s === 'object' ? s : {};
    const d = DEFAULT_SETTINGS;
    return {
        theme: typeof s.theme === 'string' && THEMES[s.theme] ? s.theme : d.theme,
        customColor: typeof s.customColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.customColor) ? s.customColor : d.customColor,
        title: typeof s.title === 'string' ? s.title.slice(0, 40) : d.title,
        subtitle: typeof s.subtitle === 'string' ? s.subtitle.slice(0, 60) : d.subtitle,
        cities: Array.isArray(s.cities) ? s.cities.slice(0, 2).map(c => typeof c === 'string' ? c : '') : d.cities.slice(),
        avatar: typeof s.avatar === 'string' ? s.avatar : d.avatar,
        engine: typeof s.engine === 'string' && ENGINES[s.engine] ? s.engine : d.engine,
        language: typeof s.language === 'string' ? s.language : d.language,
        bg: normalizeBg(s.bg),
        appearance: normalizeAppearance(s.appearance)
    };
}

function normalizeCategories(cats) {
    if (!Array.isArray(cats)) return [];
    return cats.map(c => {
        if (!c || typeof c !== 'object') return null;
        return {
            id: typeof c.id === 'string' && c.id ? c.id : uid(),
                    icon: typeof c.icon === 'string' ? c.icon : '',
                    image: typeof c.image === 'string' ? c.image : '',
                    name: typeof c.name === 'string' ? c.name : 'Category',
                    shortcuts: Array.isArray(c.shortcuts) ? c.shortcuts.map(s => ({
                        id: typeof s?.id === 'string' && s.id ? s.id : uid(),
                                                                                  title: typeof s?.title === 'string' ? s.title : '',
                                                                                  url: typeof s?.url === 'string' ? s.url : '',
                                                                                  icon: typeof s?.icon === 'string' ? s.icon : ''
                    })) : []
        };
    }).filter(Boolean);
}

function normalizeHistory(h) {
    if (!Array.isArray(h)) return [];
    return h.map(x => ({
        id: typeof x?.id === 'string' && x.id ? x.id : uid(),
                       q: typeof x?.q === 'string' ? x.q : ''
    }));
}

function migrateBackup(data) {
    if (!data || typeof data !== 'object') throw new Error('Невалидный бэкап');

    if (data.format === 'koch-brauzer-profile' && data.profile) {
        const p = data.profile;
        return {
            settings: normalizeSettings(p.settings),
            categories: normalizeCategories(p.categories),
            history: normalizeHistory(p.history),
            media: Array.isArray(p.media) ? p.media.filter(m => m && m.id && m.data) : []
        };
    }
    return {
        settings: normalizeSettings(data.settings || data),
        categories: normalizeCategories(data.categories),
        history: normalizeHistory(data.history),
        media: Array.isArray(data.media) ? data.media.filter(m => m && m.id && m.data) : []
    };
}

/* ---------- 6. Медиа (IndexedDB) ---------- */
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

async function mediaKeys() {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('media', 'readonly');
        const rq = tx.objectStore('media').getAllKeys();
        rq.onsuccess = () => resolve(rq.result || []);
        rq.onerror = () => reject(rq.error);
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

function base64ToBlob(dataUrl, mime) {
    const parts = dataUrl.split(',');
    if (parts.length < 2) throw new Error('Invalid data URL');
    const bytes = atob(parts[1]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime || 'application/octet-stream' });
}

async function compressImageBlob(blob, maxWidth = 1920) {
    if (!blob.type || !blob.type.startsWith('image/') || blob.size < 512 * 1024) return blob;
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
            if (scale >= 1) { URL.revokeObjectURL(url); resolve(blob); return; }
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(b => {
                URL.revokeObjectURL(url);
                resolve(b && b.size < blob.size ? b : blob);
            }, 'image/jpeg', 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
        img.src = url;
    });
}

async function exportMedia() {
    const list = [];
    try {
        for (const key of await mediaKeys()) {
            let blob = await mediaGet(key);
            if (!blob) continue;
            if (blob.type && blob.type.startsWith('image/')) blob = await compressImageBlob(blob);
            list.push({ id: key, mime: blob.type || '', size: blob.size || 0, data: await blobToBase64(blob) });
        }
    } catch (err) { console.warn('[KOCH] exportMedia:', err); }
    return list;
}

async function importMedia(list) {
    if (!Array.isArray(list)) return;
    for (const m of list) {
        if (!m || !m.id || !m.data) continue;
        try { await mediaPut(m.id, base64ToBlob(m.data, m.mime)); }
        catch (err) { console.warn('[KOCH] importMedia:', m.id, err); }
    }
}

/* ---------- Store ---------- */
const store = {
    async getSettings() {
        if (settingsCache) return clone(settingsCache);
        const data = await apiStorage.get(['settings', 'schemaVersion']);
        let s = data.settings;
        if ((data.schemaVersion || 1) < CURRENT_SCHEMA || !s) {
            s = normalizeSettings(s);
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

    async exportAll(opts = {}) {
        const { includeMedia = true, includeCatImages = true } = opts;
        const data = await apiStorage.get(['settings', 'categories', 'history']);

        let cats = data.categories || clone(DEFAULT_CATEGORIES);
        if (!includeCatImages) {
            cats = cats.map(c => ({ ...c, image: '' }));
        }

        const profile = {
            format: 'koch-brauzer-profile',
                version: PROFILE_FORMAT_VERSION,
                exportedAt: new Date().toISOString(),
                profile: {
                    settings: data.settings || clone(DEFAULT_SETTINGS),
                    categories: cats,
                    history: data.history || [],
                    media: includeMedia ? await exportMedia() : []
                }
        };
        return JSON.stringify(profile);
    },

    async importAll(json) {
        let data;
        try { data = JSON.parse(json); } catch { throw new Error('Невалидный JSON'); }

        const migrated = migrateBackup(data);

        if (migrated.media.length > 0) await importMedia(migrated.media);

        if (migrated.settings.bg.idb) {
            const inBackup = migrated.media.some(m => m.id === migrated.settings.bg.idb);
            if (!inBackup) {
                const exists = await mediaGet(migrated.settings.bg.idb).catch(() => null);
                if (!exists) migrated.settings.bg.idb = '';
            }
        }

        await apiStorage.set({
            settings: migrated.settings,
            categories: migrated.categories,
            history: migrated.history,
            schemaVersion: CURRENT_SCHEMA
        });
        settingsCache = null;
        return migrated;
    }
};

/* ---------- 7. Темы ---------- */
const THEMES = {
    rose: 'Розовая', purple: 'Фиолетовая', ocean: 'Океан', green: 'Изумруд',
    dark: 'Тёмная', light: 'Светлая', midnight: 'Полночь', sunset: 'Закат',
    custom: 'Своя'
};

let appliedTheme = null, applying = false, bgObjectUrl = null;

function applyCustomThemeVars(hex) {
    const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ff4fa3';
    const { r, g, b } = hexToRgb(clean);
    const { h, s, l } = rgbToHsl(r, g, b);
    const cl = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

    const S = cl(s, 30, 90);
    const L = cl(l, 15, 85);
    const d = L / 60;

    const bg      = hslHex(h, S * 0.55, cl(4 * d, 2, 14));
    const panel   = hslHex(h, S * 0.60, cl(8 * d, 4, 22));
    const card    = hslHex(h, S * 0.60, cl(11 * d, 6, 28));
    const card2   = hslHex(h, S * 0.60, cl(15 * d, 9, 34));
    const accent  = clean;
    const accent2 = hslHex(h, cl(S, 40, 90), cl(L + 16, 55, 88));
    const yellow  = hslHex((h + 50) % 360, 75, 70);
    const text    = hslHex(h, S * 0.30, 93);
    const muted   = hslHex(h, S * 0.50, cl(L * 0.8 + 15, 45, 72));
    const orb1    = hslHex(h, cl(S * 1.15, 40, 95), cl(L, 40, 65));
    const orb2    = hslHex(h, S * 0.80, cl(L * 0.35, 8, 30));
    const orb3    = accent2;

    const st = document.documentElement.style;
    st.setProperty('--bg', bg);
    st.setProperty('--panel', rgbaOf(panel, 'var(--panel-opacity)'));
    st.setProperty('--card', rgbaOf(card, 'var(--card-opacity)'));
    st.setProperty('--card2', rgbaOf(card2, 'var(--card-opacity)'));
    st.setProperty('--accent', accent);
    st.setProperty('--accent2', accent2);
    st.setProperty('--yellow', yellow);
    st.setProperty('--text', text);
    st.setProperty('--muted', muted);
    st.setProperty('--border', rgbaOf(accent, 0.28));
    st.setProperty('--border-hi', rgbaOf(accent, 0.55));
    st.setProperty('--glow', rgbaOf(accent, 0.35));
    st.setProperty('--orb1', orb1);
    st.setProperty('--orb2', orb2);
    st.setProperty('--orb3', orb3);
}

function clearCustomThemeVars() {
    const st = document.documentElement.style;
    ['--bg','--panel','--card','--card2','--accent','--accent2','--yellow',
    '--text','--muted','--border','--border-hi','--glow','--orb1','--orb2','--orb3']
    .forEach(k => st.removeProperty(k));
}

async function applyTheme(id, persist = true) {
    if (applying) return;
    applying = true;
    try {
        if (!THEMES[id]) id = 'rose';
        if (id === appliedTheme && !persist) { applying = false; return; }
        appliedTheme = id;
        document.body.dataset.theme = id;
        if (id === 'custom') {
            const s = await store.getSettings();
            applyCustomThemeVars(s.customColor || '#ff4fa3');
        } else {
            clearCustomThemeVars();
        }
        if (persist) await store.updateSettings(s => ({ ...s, theme: id }));
    } finally { applying = false; }
}

function applyAppearance(app) {
    if (!app) return;
    const r = document.documentElement;
    r.style.setProperty('--panel-opacity', (app.panelOpacity ?? 72) / 100);
    r.style.setProperty('--card-opacity', (app.cardOpacity ?? 100) / 100);
    r.style.setProperty('--panel-blur', (app.panelBlur ?? 0) + 'px');
    r.style.setProperty('--card-blur', (app.cardBlur ?? 0) + 'px');
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
        const blob = await mediaGet(bg.idb).catch(() => null);
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
        if (v.dataset.kbUrl !== url) {
            v.dataset.kbUrl = url;
            v.src = url;
            if (!document.hidden) v.play().catch(() => {});
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

/* ---------- 7.1. Пауза видео: вкладки + сворачивание окна ---------- */
function setupVideoVisibility() {
    const pauseVideo = () => {
        const v = document.getElementById('bg-video');
        if (v && !v.paused && v.src) {
            v.pause();
            v.dataset.kbWasPlaying = '1';
        }
    };

    const resumeVideo = async () => {
        const v = document.getElementById('bg-video');
        if (!v || !v.src || !v.dataset.kbUrl) return;
        try {
            const s = await store.getSettings();
            if (s.bg?.type === 'video') {
                v.play().catch(() => {});
                v.dataset.kbWasPlaying = '';
            }
        } catch {}
    };

    // 1. Переключение вкладок (основной обработчик)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseVideo();
        else resumeVideo();
    });

        // 2. Сворачивание окна / потеря фокуса браузером
        //    (в некоторых браузерах при минимизации окна
        //     документ не сразу становится скрытым)
        window.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.hidden) pauseVideo();
            }, 120);
        });

        // 3. Возврат фокуса окну (после разворачивания)
        window.addEventListener('focus', () => {
            if (!document.hidden) resumeVideo();
        });

            // 4. bfcache (навигация назад/вперёд)
            window.addEventListener('pagehide', pauseVideo);
            window.addEventListener('pageshow', () => {
                if (!document.hidden) resumeVideo();
            });
}

function paintTitle(s) {
    const t = document.getElementById('main-title');
    if (!t) return;
    const raw = (s.title || 'KOCH BRAUZER').trim();
    t.textContent = raw;
    document.title = raw || 'KOCH BRAUZER';
}

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

/* ---------- 8. Часы и погода ---------- */
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

/* ---------- 9. Поиск ---------- */
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

/* ---------- 10. Категории и ярлыки ---------- */
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

    let icoNode;
    if (cat.image) {
        icoNode = el('img', { class: 'cat-ico cat-ico-img', src: cat.image, alt: '', draggable: false,
            onerror: e => e.target.replaceWith(el('span', { class: 'cat-ico' }, cat.icon || '')) });
    } else {
        icoNode = el('span', { class: 'cat-ico' }, cat.icon || '');
    }

    const head = el('div', { class: 'cat-head', draggable: true },
                    icoNode,
                    el('span', { class: 'cat-name' }, cat.name),
                    el('button', { class: 'cat-add', onclick: e => { e.stopPropagation(); openScModal(cat.id, null); } }, '＋')
    );
    head.addEventListener('contextmenu', e => {
        e.preventDefault();
        const hasImg = !!cat.image;
        const hasEmoji = !!cat.icon;
        const action = prompt(
            `Категория «${cat.name}»:\n` +
            `1 — переименовать\n` +
            `2 — удалить\n` +
            `3 — загрузить картинку категории\n` +
            `4 — убрать картинку (вернуть эмодзи)\n` +
            `5 — убрать эмодзи\n` +
            `6 — поставить случайный эмодзи\n` +
            `7 — ввести своё эмодзи`, '1');
        if (action === '1') {
            const name = prompt('Новое название:', cat.name);
            if (name?.trim()) { cat.name = name.trim().toUpperCase(); saveCats(); }
        } else if (action === '2' && confirm(`Удалить категорию «${cat.name}»?`)) {
            categories = categories.filter(c => c.id !== cat.id);
            saveCats(); toast('Категория удалена');
        } else if (action === '3') {
            uploadCategoryImage(cat.id);
        } else if (action === '4') {
            if (hasImg) {
                cat.image = '';
                saveCats();
                toast('Картинка категории убрана');
            } else {
                toast('У категории нет картинки', 'error');
            }
        } else if (action === '5') {
            if (hasEmoji && !hasImg) {
                cat.icon = '';
                saveCats();
                toast('Эмодзи убрано');
            } else if (hasImg) {
                toast('Сначала убери картинку (пункт 4)', 'error');
            } else {
                toast('У категории нет эмодзи', 'error');
            }
        } else if (action === '6') {
            const emojis = ['🌐','🎵','🎮','💻','🛒','📁','🎨','📚','🏠','⚡','🔥','💎','🚀','🎯','☕','🍕','🌙','⭐','🎬','📱'];
            cat.icon = emojis[Math.floor(Math.random() * emojis.length)];
            saveCats();
            toast('Случайный эмодзи: ' + cat.icon);
        } else if (action === '7') {
            const customEmoji = prompt(
                'Введите свой эмодзи:\n\n' +
                'Примеры: 🚀 💡 🎧 🐱 🌸 🔒 ✨\n' +
                '(можно скопировать с emojipedia.org или из любой переписки)\n\n' +
                'Пустое поле — убрать эмодзи',
                cat.icon || ''
            );
            if (customEmoji === null) return;
            if (customEmoji.trim() === '') {
                cat.icon = '';
                saveCats();
                toast('Эмодзи убрано');
                return;
            }
            const trimmed = customEmoji.trim();
            if (trimmed.length > 8) {
                toast('Слишком длинно. Это эмодзи?', 'error');
                return;
            }
            cat.icon = trimmed;
            saveCats();
            toast('Эмодзи обновлён: ' + cat.icon);
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

async function saveCats() {
    await store.setCategories(categories);
    renderCats();
}

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

function uploadCategoryImage(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const dataUrl = await downscaleImage(file, 128);
            cat.image = dataUrl;
            await saveCats();
            toast('Картинка категории обновлена');
        } catch (err) {
            console.error('[KOCH] cat image:', err);
            toast('Не удалось загрузить картинку', 'error');
        }
    };
    input.click();
}

function updateIconPreview(iconValue, urlValue) {
    const preview = $('#sc-icon-preview');
    const hint = $('#sc-icon-hint');
    if (!preview) return;

    if (iconValue && (/^https?:/.test(iconValue) || iconValue.startsWith('data:'))) {
        preview.src = iconValue;
        preview.hidden = false;
        if (hint) hint.textContent = 'Своя иконка';
    } else if (iconValue) {
        preview.hidden = true;
        if (hint) hint.textContent = 'Эмодзи: ' + iconValue;
    } else {
        const src = urlValue ? faviconOf(urlValue) : '';
        if (src) { preview.src = src; preview.hidden = false; }
        else preview.hidden = true;
        if (hint) hint.textContent = 'Дефолтная иконка по домену';
    }
}

function uploadShortcutIcon() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const dataUrl = await downscaleImage(file, 64);
            const iconField = $('#sc-icon');
            if (iconField) iconField.value = dataUrl;
            updateIconPreview(dataUrl, $('#sc-url')?.value || '');
            toast('Иконка загружена');
        } catch (err) {
            console.error('[KOCH] icon upload:', err);
            toast('Не удалось загрузить иконку', 'error');
        }
    };
    input.click();
}

function openScModal(catId, scId) {
    scModal = { catId, scId };
    const cat = categories.find(c => c.id === catId);
    const sc = cat?.shortcuts?.find(x => x.id === scId);
    const name = $('#sc-name'), url = $('#sc-url'), icon = $('#sc-icon');
    if (name) name.value = sc?.title || '';
    if (url) url.value = sc?.url || '';
    if (icon) icon.value = sc?.icon || '';
    updateIconPreview(sc?.icon || '', sc?.url || '');
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

    $('#sc-icon-upload')?.addEventListener('click', uploadShortcutIcon);

    $('#sc-icon-reset')?.addEventListener('click', () => {
        const iconField = $('#sc-icon');
        if (iconField) iconField.value = '';
        updateIconPreview('', $('#sc-url')?.value || '');
        toast('Иконка сброшена на дефолтную');
    });

    $('#sc-url')?.addEventListener('input', debounce(() => {
        const iconVal = ($('#sc-icon')?.value || '').trim();
        updateIconPreview(iconVal, $('#sc-url')?.value || '');
    }, 300));
}

function bindAddCat() {
    $('#add-cat')?.addEventListener('click', async () => {
        const name = prompt('Название новой категории:');
        if (!name?.trim()) return;
        const emojis = ['🌐','🎵','🎮','💻','🛒','📁','🎨','📚','🏠','⚡'];
        categories.push({
            id: uid(),
                        icon: emojis[Math.floor(Math.random() * emojis.length)],
                        image: '',
                        name: name.trim().toUpperCase(),
                        shortcuts: []
        });
        await saveCats();
        toast('Категория добавлена');
    });
}

/* ---------- 11. Настройки ---------- */
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

async function setCustomColor(hex) {
    await ensureSettings();
    currentSettings = await store.updateSettings(s => ({ ...s, customColor: hex, theme: 'custom' }));
    document.body.dataset.theme = 'custom';
    appliedTheme = 'custom';
    applyCustomThemeVars(hex);
    const sel = $('#theme-select'); if (sel) sel.value = 'custom';
}

function bindSlider(inputId, path, valueId, suffix, step = 1) {
    on(inputId, 'input', debounce(e => {
        const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        txt(valueId, v + suffix);
        const parts = path.split('.');
        if (parts.length === 1) updateAppearanceSetting(parts[0], v);
        else updateAppearanceSetting(parts[0], prev => ({ ...prev, [parts[1]]: v }));
    }, 100));
}

function paintAvatar(url) {
    const img = document.getElementById('avatar-img'), fb = document.getElementById('avatar-fallback');
    if (!img || !fb) return;
    if (url) { img.src = url; img.hidden = false; fb.hidden = true; }
    else { img.hidden = true; fb.hidden = false; }
}

function invalidateRuntimeState() {
    settingsCache = null;
    currentSettings = null;
    categories = [];
    qHistory = [];
    appliedTheme = null;
    if (bgObjectUrl) {
        try { URL.revokeObjectURL(bgObjectUrl); } catch {}
        bgObjectUrl = null;
    }
}

function bindSettings() {
    on('settings-btn', 'click', openSettings);
    document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', e => { if (e.target === ov) ov.hidden = true; });
    });
    document.querySelectorAll('[data-close]').forEach(b => {
        b.addEventListener('click', () => { const t = document.getElementById(b.getAttribute('data-close')); if (t) t.hidden = true; });
    });

    on('set-title', 'input', debounce(async e => {
        await updateSetting('title', e.target.value);
        paintTitle({ title: e.target.value });
    }, 300));

    on('set-subtitle', 'input', debounce(async e => {
        await updateSetting('subtitle', e.target.value);
        txt('subtitle', e.target.value);
    }, 300));

    const cityHandler = idx => debounce(async e => {
        await updateSetting('cities', prev => { const c = (prev || []).slice(); c[idx] = e.target.value; return c; });
        initClocks();
    }, 500);
    on('set-city-a', 'input', cityHandler(0));
    on('set-city-b', 'input', cityHandler(1));

    on('set-avatar', 'change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const url = await downscaleImage(f, 256);
            await updateSetting('avatar', url);
            paintAvatar(url); toast('Аватар обновлён');
        } catch (err) {
            toast('Не удалось прочитать файл', 'error');
        }
        e.target.value = '';
    });
    on('reset-avatar', 'click', async () => {
        await updateSetting('avatar', ''); paintAvatar(''); toast('Аватар сброшен');
    });

    on('set-bg-type', 'change', async e => {
        await updateSetting('bg', prev => ({ ...prev, type: e.target.value }));
        await applyBackground();
    });
    on('set-bg-file', 'change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const type = f.type.indexOf('video') === 0 ? 'video' : 'image';
            await mediaPut(MEDIA_KEY, f);
            await updateSetting('bg', prev => ({ ...prev, type, url: '', idb: MEDIA_KEY }));
            val('set-bg-type', type); val('set-bg-url', '');
            await applyBackground(); toast('Фон обновлён');
        } catch (err) {
            console.error('[KOCH] bg save:', err);
            toast('Не удалось сохранить файл фона', 'error');
        }
        e.target.value = '';
    });
    on('set-bg-url', 'change', async e => {
        const u = e.target.value.trim();
        await updateSetting('bg', prev => ({ ...prev, url: u, idb: '' }));
        if (u) mediaDel(MEDIA_KEY).catch(err => console.warn('[KOCH] media del:', err));
        await applyBackground(); toast('Фон обновлён');
    });
    on('set-bg-opacity', 'input', debounce(async e => {
        const v = parseInt(e.target.value, 10);
        txt('set-bg-opacity-val', v + '%');
        await updateSetting('bg', prev => ({ ...prev, opacity: v }));
        await applyBackground();
    }, 100));
    on('set-bg-blur', 'input', debounce(async e => {
        const v = parseInt(e.target.value, 10);
        txt('set-bg-blur-val', v + 'px');
        await updateSetting('bg', prev => ({ ...prev, blur: v }));
        await applyBackground();
    }, 100));

    bindSlider('set-panel-opacity', 'panelOpacity', 'set-panel-opacity-val', '%');
    bindSlider('set-card-opacity', 'cardOpacity', 'set-card-opacity-val', '%');
    bindSlider('set-panel-blur', 'panelBlur', 'set-panel-blur-val', 'px');
    bindSlider('set-card-blur', 'cardBlur', 'set-card-blur-val', 'px');
    bindSlider('set-radius-panel', 'radius.panel', 'set-radius-panel-val', 'px');
    bindSlider('set-radius-card', 'radius.card', 'set-radius-card-val', 'px');
    bindSlider('set-radius-button', 'radius.button', 'set-radius-button-val', 'px');
    bindSlider('set-radius-chip', 'radius.chip', 'set-radius-chip-val', 'px');
    bindSlider('set-radius-input', 'radius.input', 'set-radius-input-val', 'px');
    on('set-font-family', 'change', e => updateAppearanceSetting('font', prev => ({ ...prev, family: e.target.value })));
    bindSlider('set-font-size', 'font.size', 'set-font-size-val', 'px');
    bindSlider('set-font-weight', 'font.weight', 'set-font-weight-val', '');
    bindSlider('set-line-height', 'font.lineHeight', 'set-line-height-val', '', 0.1);
    on('set-animations', 'change', e => updateAppearanceSetting('animations', e.target.checked));
    bindSlider('set-transition-speed', 'transitionSpeed', 'set-transition-speed-val', 's', 0.01);

    on('set-custom-color', 'input', debounce(e => {
        const hex = e.target.value;
        val('set-custom-hex', hex);
        setCustomColor(hex);
    }, 80));
    on('set-custom-hex', 'change', e => {
        let hex = e.target.value.trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) { toast('HEX вида #rrggbb', 'error'); return; }
        if (hex[0] !== '#') hex = '#' + hex;
        hex = hex.toLowerCase();
        val('set-custom-color', hex);
        val('set-custom-hex', hex);
        setCustomColor(hex);
    });

    /* ====== EXPORT: 3 варианта ====== */
    on('export-btn', 'click', async () => {
        try {
            const data = await apiStorage.get(['settings', 'categories', 'history']);
            const profileKB = Math.round(JSON.stringify({
                s: data.settings, c: data.categories, h: data.history
            }).length / 1024);

            const media = await exportMedia();
            const mediaMB = media.reduce((s, m) => s + (m.data?.length || 0), 0) * 0.75 / 1048576;
            const hasMedia = media.length > 0 && mediaMB > 0.1;
            const catImagesKB = Math.round(
                (data.categories || []).reduce((s, c) => s + (c.image?.length || 0), 0) / 1024
            );

            let includeMedia = false;
            let includeCatImages = true;

            if (hasMedia || catImagesKB > 500) {
                const mediaHint = hasMedia ? mediaMB.toFixed(1) + ' МБ' : '0 МБ';
                const catHint = catImagesKB >= 1024 ? (catImagesKB / 1024).toFixed(1) + ' МБ' : catImagesKB + ' КБ';

                const choice = prompt(
                    '📦 Экспорт профиля\n' +
                    '─────────────────────────\n' +
                    `Настройки + категории: ~${profileKB} КБ\n` +
                    `Картинки категорий: ${catHint}\n` +
                    `Фон (медиа): ${mediaHint}\n` +
                    '─────────────────────────\n\n' +
                    'Введите цифру:\n' +
                    '1 — компактный (без картинок категорий и фона)\n' +
                    '2 — всё кроме фона (с картинками категорий)\n' +
                    '3 — полный (со всем)\n' +
                    '(пусто или Отмена — выход)',
                                      '2'
                );

                if (!choice) return;
                if (choice === '1') { includeMedia = false; includeCatImages = false; }
                else if (choice === '2') { includeMedia = false; includeCatImages = true; }
                else if (choice === '3') { includeMedia = true; includeCatImages = true; }
                else { toast('Неверный выбор', 'error'); return; }
            }

            const json = await store.exportAll({ includeMedia, includeCatImages });
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);

            let suffix = 'light';
            if (includeMedia && includeCatImages) suffix = 'full';
            else if (includeCatImages) suffix = 'no-bg';
            a.download = `koch-brauzer-${suffix}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            const sizeKB = Math.round(blob.size / 1024);
            const sizeStr = sizeKB >= 1024 ? (sizeKB / 1024).toFixed(1) + ' МБ' : sizeKB + ' КБ';
            toast(`Экспортировано (${sizeStr})`);
        } catch (err) {
            console.error('[KOCH] export:', err);
            toast('Ошибка экспорта: ' + err.message, 'error');
        }
    });

    /* ====== IMPORT ====== */
    on('import-btn', 'change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const text = await f.text();
            await store.importAll(text);
            invalidateRuntimeState();
            toast('Импортировано, перезагрузка…');
            setTimeout(() => location.reload(), 800);
        } catch (err) {
            console.error('[KOCH] import:', err);
            toast('Ошибка импорта: ' + err.message, 'error');
        }
    });

    on('reset-btn', 'click', async () => {
        if (confirm('Сбросить все настройки и данные?')) { await store.reset(); location.reload(); }
    });
}

function setSlider(inputId, value, valueId, suffix) { val(inputId, value); txt(valueId, value + suffix); }

async function openSettings() {
    currentSettings = await store.getSettings();
    val('theme-select', currentSettings.theme || 'rose');
    val('set-title', currentSettings.title || 'KOCH BRAUZER');
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
    setSlider('set-panel-blur', app.panelBlur ?? 0, 'set-panel-blur-val', 'px');
    setSlider('set-card-blur', app.cardBlur ?? 0, 'set-card-blur-val', 'px');

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

    const cc = (currentSettings.customColor || '#ff4fa3').toLowerCase();
    val('set-custom-color', cc);
    val('set-custom-hex', cc);

    const ov = document.getElementById('settings-overlay');
    if (ov) ov.hidden = false;
}

/* ---------- 12. Запуск ---------- */
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
        s.bg = await repairBgMedia(s);
        await applyTheme(s.theme, false);
        applyAppearance(s.appearance);
        await applyBackground(s);
        paintTitle(s);
        const sub = $('#subtitle'); if (sub) sub.textContent = s.subtitle || '';
        paintAvatar(s.avatar || '');
        initThemeSelector(s.theme);

        // Пауза видео: вкладки + сворачивание окна
        setupVideoVisibility();

        initClocks(s);
        await Promise.all([initSearch(s), renderCats()]);
        bindAddCat(); bindScModal(); bindSettings(); bindKeys();

        let lastCities = JSON.stringify(s.cities || []);
        const sync = debounce(async next => {
            if (!next) return;
            await applyTheme(next.theme, false);
            applyAppearance(next.appearance);
            await applyBackground(next);
            paintTitle(next);
            if (sub) sub.textContent = next.subtitle || '';
            paintAvatar(next.avatar || '');
            const sel = $('#theme-select'); if (sel) sel.value = next.theme || 'rose';
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
