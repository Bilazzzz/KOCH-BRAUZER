/* ============ KOCH BRAUZER v3.5 — дефолт размытия 10/5 + схема v4 ============ */

/* ---------- 1. Browser API ---------- */
const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
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
            for (const [k, v] of Object.entries(items)) {
                try { localStorage.setItem('kb_' + k, JSON.stringify(v)); }
                catch (err) { console.warn('[KOCH] storage quota:', k, err); throw err; }
            }
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
    if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([\/?#]|$)/i.test(str)) return 'http://' + str;
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
    bg: { type: 'none', url: '', idb: '', opacity: 100 },
    appearance: {
        panelOpacity: 30, cardOpacity: 45,
        panelBlur: 10, historyBlur: 12, historyOpacity: 80, settingsOpacity: 88, settingsBlur: 14,
        radius: { card: 18, panel: 26, button: 10, chip: 12, input: 10 },
        font: { family: "'Product Sans','Product Sans Regular',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif", size: 16, weight: 400, lineHeight: 1, letterSpacing: 0, titleSpacing: 0.14, subtitleSpacing: 0.12 },
        animations: true, transitionSpeed: 0.28
    }
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

const CURRENT_SCHEMA = 6;
const PROFILE_FORMAT_VERSION = 3;
const MEDIA_KEY = 'bg-media';
let settingsCache = null;
const EASE = 'cubic-bezier(.22,.7,.3,1)';
function animDur(ms) { return document.documentElement.classList.contains('reduce-motion') ? 0 : ms; }

/* ---------- 5. Нормализация и миграция ---------- */
function normalizeBg(bg) {
    bg = bg && typeof bg === 'object' ? bg : {};
    return {
        type: ['none', 'image', 'video'].includes(bg.type) ? bg.type : 'none',
        url: typeof bg.url === 'string' ? bg.url : '',
        idb: typeof bg.idb === 'string' ? bg.idb : '',
        opacity: num(bg.opacity, 100, 0, 100)
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
        panelBlur: num(app.panelBlur, d.panelBlur, 0, 20),
        historyBlur: num(app.historyBlur, d.historyBlur, 0, 30),
        historyOpacity: num(app.historyOpacity, d.historyOpacity, 0, 100),
        settingsOpacity: num(app.settingsOpacity, d.settingsOpacity, 0, 100),
        settingsBlur: num(app.settingsBlur, d.settingsBlur, 0, 30),
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
            lineHeight: num(f.lineHeight, d.font.lineHeight, 1, 3),
            letterSpacing: num(f.letterSpacing, d.font.letterSpacing, -0.05, 0.3),
            titleSpacing: num(f.titleSpacing, d.font.titleSpacing, 0, 0.6),
            subtitleSpacing: num(f.subtitleSpacing, d.font.subtitleSpacing, 0, 0.6)
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
        bg: normalizeBg(s.bg),
        appearance: normalizeAppearance(s.appearance)
    };
}

/* Миграция схемы хранилища */
function migrateSettings(s, ver) {
    const m = normalizeSettings(s);
    if (ver < 4) {
        const oldApp = s && typeof s === 'object' && s.appearance ? s.appearance : {};
        if ((oldApp.panelBlur ?? 0) === 0) m.appearance.panelBlur = DEFAULT_SETTINGS.appearance.panelBlur;
    }
    if (ver < 5 && m.appearance.font.lineHeight === 1.5) m.appearance.font.lineHeight = 1;
    return m;
}

function normalizeCategories(cats) {
    if (cats && !Array.isArray(cats) && typeof cats === 'object') cats = Object.values(cats);
    if (!Array.isArray(cats)) return [];
    const str = (...v) => { for (const x of v) if (typeof x === 'string' && x) return x; return ''; };
    const usedC = new Set(), usedS = new Set();
    const uniq = (id, set) => { if (!id || set.has(id)) id = uid(); set.add(id); return id; };
    return cats.map(c => {
        if (!c || typeof c !== 'object') return null;
        const list = [c.shortcuts, c.links, c.items, c.tiles, c.sites, c.bookmarks].find(Array.isArray) || [];
        return {
            id: uniq(str(c.id), usedC),
            icon: str(c.icon, c.emoji),
            image: str(c.image, c.img),
            name: str(c.name, c.title) || 'Category',
            shortcuts: list.map(x => {
                if (typeof x === 'string') x = { url: x, title: x };
                if (!x || typeof x !== 'object') return null;
                return {
                    id: uniq(str(x.id), usedS),
                    title: str(x.title, x.name, x.label),
                    url: str(x.url, x.href, x.link),
                    icon: str(x.icon, x.image, x.favicon)
                };
            }).filter(Boolean)
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
            categories: normalizeCategories(p.categories || p.settings?.categories),
            history: normalizeHistory(p.history),
            media: Array.isArray(p.media) ? p.media.filter(m => m && m.id && m.data) : []
        };
    }
    return {
        settings: normalizeSettings(data.settings || data),
        categories: normalizeCategories(data.categories || data.data?.categories || data.settings?.categories),
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
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => { db.close(); idbPromise = null; };
                resolve(db);
            };
            req.onerror = () => { idbPromise = null; reject(req.error); };
            req.onblocked = () => { idbPromise = null; reject(new Error('IndexedDB blocked')); };
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
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
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
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
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
        const ver = data.schemaVersion || 1;
        if (ver < CURRENT_SCHEMA || !s) {
            s = migrateSettings(s, ver);
            await this.setSettings(s, false);
            await apiStorage.set({ schemaVersion: CURRENT_SCHEMA });
        }
        s = normalizeSettings(s);   // отбрасывает устаревшие ключи (например, старые blur фона/карточек)
        settingsCache = s;
        return clone(s);
    },
    async setSettings(s, inv = true) { if (inv) settingsCache = null; await apiStorage.set({ settings: s }); },
    _q: Promise.resolve(),
    updateSettings(fn) {
        const run = this._q.then(async () => {
            const cur = await this.getSettings();
            const merged = normalizeSettings(fn(clone(cur)));
            await this.setSettings(merged);
            return merged;
        });
        this._q = run.catch(() => {});
        return run;
    },
    async getCategories() { const d = await apiStorage.get('categories'); return Array.isArray(d.categories) ? d.categories : clone(DEFAULT_CATEGORIES); },
    async setCategories(c) { await apiStorage.set({ categories: c }); },
    async getHistory() { const d = await apiStorage.get('history'); return Array.isArray(d.history) ? d.history : []; },
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
        const { includeMedia = true } = opts;
        const data = await apiStorage.get(['settings', 'categories', 'history']);
        const cats = data.categories || clone(DEFAULT_CATEGORIES);

        const profile = {
            format: 'koch-brauzer-profile',
                version: PROFILE_FORMAT_VERSION,
                exportedAt: new Date().toISOString(),
                profile: {
                    settings: normalizeSettings(data.settings),
                    categories: normalizeCategories(cats),
                    history: normalizeHistory(data.history),
                    media: includeMedia ? await exportMedia() : []
                }
        };
        return JSON.stringify(profile);
    },

    async importAll(json) {
        let data;
        try { data = JSON.parse(json); } catch { throw new Error('Невалидный JSON'); }
        if (!data || typeof data !== 'object') throw new Error('Файл не похож на бэкап');

        const migrated = migrateBackup(data);

        if (migrated.media.length > 0) await importMedia(migrated.media);

        if (migrated.settings.bg.idb) {
            const inBackup = migrated.media.some(m => m.id === migrated.settings.bg.idb);
            if (!inBackup) {
                const exists = await mediaGet(migrated.settings.bg.idb).catch(() => null);
                if (!exists) {
                    migrated.settings.bg.idb = '';
                    if (!migrated.settings.bg.url) migrated.settings.bg.type = 'none';
                }
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
}

function clearCustomThemeVars() {
    const st = document.documentElement.style;
    ['--bg','--panel','--card','--card2','--accent','--accent2','--yellow',
    '--text','--muted','--border','--border-hi','--glow']
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
    const d = DEFAULT_SETTINGS.appearance;
    const r = document.documentElement;
    r.style.setProperty('--panel-opacity', (app.panelOpacity ?? d.panelOpacity) / 100);
    r.style.setProperty('--card-opacity', (app.cardOpacity ?? d.cardOpacity) / 100);
    // blur(0px) всё равно создаёт слой и считается на GPU, поэтому при 0 фильтр выключается совсем
    const pb = app.panelBlur ?? d.panelBlur;
    r.style.setProperty('--panel-blur', pb + 'px');
    r.style.setProperty('--panel-bf', pb > 0 ? `blur(${pb}px)` : 'none');
    const hb = app.historyBlur ?? d.historyBlur;
    r.style.setProperty('--sg-bf', hb > 0 ? `blur(${hb}px)` : 'none');
    r.style.setProperty('--sg-op', (app.historyOpacity ?? d.historyOpacity) + '%');
    r.style.setProperty('--set-op', (app.settingsOpacity ?? d.settingsOpacity) + '%');
    const sb = app.settingsBlur ?? d.settingsBlur;
    r.style.setProperty('--set-bf', sb > 0 ? `blur(${sb}px)` : 'none');
    if (app.radius) {
        r.style.setProperty('--radius-card', (app.radius.card ?? d.radius.card) + 'px');
        r.style.setProperty('--radius-panel', (app.radius.panel ?? d.radius.panel) + 'px');
        r.style.setProperty('--radius-button', (app.radius.button ?? d.radius.button) + 'px');
        r.style.setProperty('--radius-chip', (app.radius.chip ?? d.radius.chip) + 'px');
        r.style.setProperty('--radius-input', (app.radius.input ?? d.radius.input) + 'px');
    }
    if (app.font) {
        r.style.setProperty('--font-family', app.font.family || d.font.family);
        r.style.setProperty('--font-size', (app.font.size ?? d.font.size) + 'px');
        r.style.setProperty('--font-weight', app.font.weight ?? d.font.weight);
        r.style.setProperty('--line-height', app.font.lineHeight ?? d.font.lineHeight);
        r.style.setProperty('--ls', (app.font.letterSpacing ?? d.font.letterSpacing) + 'em');
        r.style.setProperty('--ls-title', (app.font.titleSpacing ?? d.font.titleSpacing) + 'em');
        r.style.setProperty('--ls-sub', (app.font.subtitleSpacing ?? d.font.subtitleSpacing) + 'em');
    }
    r.style.setProperty('--transition-speed', (app.transitionSpeed ?? d.transitionSpeed) + 's');
    r.classList.toggle('reduce-motion', app.animations === false);
}

/* Применение фона. Вызовы выстраиваются в очередь: событие storage и ручной
   вызов приходят почти одновременно, и раньше они гонялись друг с другом
   (лишние blob-URL, перезагрузка видео, отозванный URL у только что
   назначенного src). */
let bgChain = Promise.resolve();
let bgMediaSig = '';
let bgVideoActive = false;
let bgVideoUrl = '';
let pageGone = false;

/* Страница «живая», только если вкладка видима и окно не свёрнуто. */
const isPageActive = () => !document.hidden && !pageGone;

function applyBackground(preloaded) {
    const run = bgChain.then(() => applyBackgroundNow(preloaded));
    bgChain = run.catch(() => {});
    return run;
}

/* Полностью освобождает видео (декодер и буферы), а не просто ставит на паузу. */
function releaseVideo(v) {
    try { v.pause(); } catch {}
    if (v.hasAttribute('src')) {
        v.removeAttribute('src');
        try { v.load(); } catch {}
    }
    v.dataset.kbUrl = '';
}

/* Единственное место, где решается, играет видео или нет.
   Видео играет только когда фон — видео И страница видима.
   Файл подгружается лениво — только когда страница реально видна. */
function syncVideoPlayback() {
    const v = document.getElementById('bg-video');
    if (!v) return;
    if (bgVideoActive && bgVideoUrl && isPageActive()) {
        if (v.dataset.kbUrl !== bgVideoUrl) {
            v.dataset.kbUrl = bgVideoUrl;
            v.src = bgVideoUrl;
        }
        if (v.paused) v.play().catch(() => {});
    } else if (!v.paused) {
        v.pause();
    }
}

async function applyBackgroundNow(preloaded) {
    const s = preloaded || await store.getSettings();
    const bg = s.bg || { type: 'none', url: '', idb: '' };
    const v = document.getElementById('bg-video');
    const i = document.getElementById('bg-image');
    if (!v || !i) return;

    const root = document.documentElement;
    const isMedia = bg.type === 'video' || bg.type === 'image';
    // классы СРАЗУ, до асинхронного чтения из IndexedDB
    root.classList.toggle('no-bg', !(isMedia && (bg.url || bg.idb)));
    let url = (bg.type !== 'none') ? (bg.url || '') : '';
    let sig = url ? 'url:' + url : '';
    if (bg.type !== 'none' && bg.idb) {
        const blob = await mediaGet(bg.idb).catch(() => null);
        if (blob) {
            // Файл тот же — переиспользуем уже созданный blob-URL, чтобы любое
            // изменение настроек не перезагружало видео заново.
            sig = `idb:${bg.idb}|${blob.size}|${blob.type}|${blob.lastModified || 0}|${blob.name || ''}`;
            url = (sig === bgMediaSig && bgObjectUrl) ? bgObjectUrl : URL.createObjectURL(blob);
        }
    }
    bgMediaSig = sig;
    if (bgObjectUrl && bgObjectUrl !== url) URL.revokeObjectURL(bgObjectUrl);
    bgObjectUrl = (url && url.startsWith('blob:')) ? url : null;

    const op = (bg.opacity ?? 100) / 100;
    document.documentElement.style.setProperty('--bg-opacity', op);

    // Размытие «стекла» нужно только поверх картинки/видео; на однотонном фоне оно ничего не меняет, но стоит GPU на каждом кадре hover-анимаций.
    document.documentElement.classList.toggle('no-bg', !((bg.type === 'video' || bg.type === 'image') && url));
    if (bg.type === 'video' && url) {
        i.hidden = true; v.hidden = false;
        document.documentElement.classList.remove('img-bg');
        v.style.opacity = op;
        bgVideoActive = true;
        bgVideoUrl = url;
    } else if (bg.type === 'image' && url) {
        bgVideoActive = false; bgVideoUrl = '';
        releaseVideo(v);
        v.hidden = true; i.hidden = false;
        i.style.backgroundImage = `url("${url}")`; i.style.opacity = op;
        document.documentElement.style.setProperty('--bg-img', `url("${url}")`);
        document.documentElement.classList.add('img-bg');
    } else {
        bgVideoActive = false; bgVideoUrl = '';
        releaseVideo(v);
        v.hidden = true;
        i.hidden = true; i.style.backgroundImage = '';
        document.documentElement.classList.remove('img-bg');
       
    }
    syncVideoPlayback();
}

/* ---------- 7.1. Пауза видео и таймеров: вкладки + сворачивание окна ---------- */
let videoVisibilityBound = false;

function setupVideoVisibility() {
    if (videoVisibilityBound) return;
    videoVisibilityBound = true;

    const sync = () => {
        syncVideoPlayback();
        syncClockTimers();
    };

    // Переключение вкладки, сворачивание окна, полное перекрытие окна
    document.addEventListener('visibilitychange', sync);

    // Страховка для браузеров/ОС, где visibilitychange при сворачивании приходит с задержкой
    window.addEventListener('blur', () => setTimeout(sync, 150));
    window.addEventListener('focus', sync);

    // bfcache / заморозка страницы
    window.addEventListener('pagehide', () => { pageGone = true; sync(); });
    window.addEventListener('pageshow', () => { pageGone = false; sync(); });
    document.addEventListener('freeze', () => { pageGone = true; sync(); });
    document.addEventListener('resume', () => { pageGone = false; sync(); });

    sync();
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
let clockGen = 0, clocksReady = false, lastWxAt = 0;
const WX_INTERVAL = 30 * 60 * 1000;

/* fetch с таймаутом и проверкой статуса: раньше зависший запрос или ответ 4xx/5xx
   молча ломал погоду, а временный сбой сети навсегда кэшировался как «город не найден». */
async function fetchJson(url, ms = 8000, tries = 2) {
    let err;
    for (let i = 0; i < tries; i++) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try {
            const r = await fetch(url, { signal: ctrl.signal });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (e) {
            err = e;
            if (i < tries - 1) await new Promise(res => setTimeout(res, 700));
        } finally { clearTimeout(t); }
    }
    throw err;
}

/* Постоянный кэш гео и погоды: новая вкладка рисует погоду сразу, сеть нужна только для обновления.
   Раньше при каждой новой вкладке выполнялись 2–4 запроса, и любой сбой оставлял «—» на 30 минут. */
const WX_FRESH = 15 * 60 * 1000, WX_STALE = 6 * 60 * 60 * 1000;
const wxStore = (() => {
    let d = null;
    const load = () => d || (d = (() => { try { return JSON.parse(localStorage.getItem('koch_wx')) || { geo: {}, wx: {} }; } catch { return { geo: {}, wx: {} }; } })());
    const save = () => { try { localStorage.setItem('koch_wx', JSON.stringify(d)); } catch {} };
    return {
        geo: c => load().geo[c] || null,
        wx: k => load().wx[k] || null,
        setGeo(c, v) { load().geo[c] = v; save(); },
        setWx(k, v) { load().wx[k] = v; save(); }
    };
})();
let wxRetryN = 0, wxRetryT = 0, wxNeedRetry = false;
function scheduleWxRetry() {
    clearTimeout(wxRetryT);
    if (wxRetryN >= 20) return;
    wxRetryT = setTimeout(() => { if (isPageActive()) refreshWeather(); }, Math.min(3000 * 2 ** Math.min(wxRetryN++, 5), 60000));
}
const wxText = w => `${w.t > 0 ? '+' : ''}${w.t}°C ${wxEmoji(w.code)}`;

async function geocode(city) {
    if (!city || city === '—') return null;
    if (geoCache.has(city)) return geoCache.get(city);
    const saved = wxStore.geo(city);
    if (saved) { geoCache.set(city, saved); return saved; }
    try {
        const d = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`);
        const g = d?.results?.[0];
        const info = g ? { lat: g.latitude, lon: g.longitude, tz: g.timezone || null } : null;
        geoCache.set(city, info);
        if (info) wxStore.setGeo(city, info);
        return info;
    } catch { return null; } // сбой сети не кэшируем: следующая попытка повторит запрос
}

async function weather(lat, lon) {
    const key = lat + ',' + lon, c = wxStore.wx(key);
    if (c && Date.now() - c.at < WX_FRESH) return c;
    const d = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
    const w = { t: Math.round(d.current.temperature_2m), code: d.current.weather_code, at: Date.now() };
    wxStore.setWx(key, w);
    return w;
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

/* Форматтер и DOM-элемент кэшируются в слоте: раньше каждую секунду
   создавался новый Intl.DateTimeFormat и выполнялся querySelector. */
function tick() {
    const now = new Date();
    for (let i = 0; i < clockSlots.length; i++) {
        const s = clockSlots[i];
        const elT = s.el || (s.el = $(i === 0 ? '#time-a' : '#time-b'));
        if (!elT) continue;
        let text;
        try {
            if (!s.fmt) {
                s.fmt = new Intl.DateTimeFormat('ru-RU', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: s.tz || undefined
                });
            }
            text = s.fmt.format(now);
        } catch { s.fmt = null; text = now.toLocaleTimeString('ru-RU'); }
        if (elT.textContent !== text) elT.textContent = text;
    }
}

async function refreshWeather() {
    const slots = clockSlots, gen = clockGen;
    const pending = new Map();
    let failed = false;
    await Promise.all(slots.map(async (s, i) => {
        const wxEl = $(i === 0 ? '#wx-a' : '#wx-b');
        if (!wxEl) return;
        // повторная попытка геокодинга, если при старте не было сети
        if (!s.geo && s.city && s.city !== '—') {
            s.geo = await geocode(s.city);
            if (s.geo) { s.tz = s.geo.tz || null; s.fmt = null; }
        }
        if (gen !== clockGen) return;
        const named = s.city && s.city !== '—';
        if (!s.geo) { wxEl.textContent = '—'; if (named) failed = true; return; }
        const key = s.geo.lat + ',' + s.geo.lon;
        const cached = wxStore.wx(key);
        if (cached && Date.now() - cached.at < WX_STALE && gen === clockGen) wxEl.textContent = wxText(cached);
        try {
            // один и тот же город в обоих слотах — один запрос вместо двух
            if (!pending.has(key)) pending.set(key, weather(s.geo.lat, s.geo.lon));
            const w = await pending.get(key);
            if (gen === clockGen) wxEl.textContent = wxText(w);
        } catch {
            failed = true;
            // при сбое показываем последнюю известную погоду (до 6 ч), а не «—»
            const c = wxStore.wx(key);
            if (gen === clockGen) wxEl.textContent = c && Date.now() - c.at < WX_STALE ? wxText(c) : '—';
        }
    }));
    if (gen !== clockGen) return;
    wxNeedRetry = failed;
    if (failed) scheduleWxRetry();
    else { wxRetryN = 0; lastWxAt = Date.now(); }
}
window.addEventListener('online', () => { wxRetryN = 0; if (clocksReady && isPageActive()) refreshWeather(); });

function stopClockTimers() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (wxTimer) { clearInterval(wxTimer); wxTimer = null; }
}

function startClockTimers() {
    stopClockTimers();
    if (!isPageActive() || !clockSlots.length) return;
    tick();
    tickTimer = setInterval(tick, 1000);
    if (clocksReady) {
        wxTimer = setInterval(refreshWeather, WX_INTERVAL);
        if (wxNeedRetry || Date.now() - lastWxAt >= WX_INTERVAL) { wxRetryN = 0; refreshWeather(); }
    }
}

/* Пока вкладка скрыта или окно свёрнуто — таймеры часов и погоды не тикают. */
function syncClockTimers() {
    if (!isPageActive()) { if (tickTimer || wxTimer) stopClockTimers(); }
    else if (!tickTimer) startClockTimers();
}

async function initClocks(preloaded) {
    stopClockTimers();
    const gen = ++clockGen;
    clocksReady = false;
    const s = preloaded || await store.getSettings();
    if (gen !== clockGen) return;
    const cities = s.cities || ['—', '—'];
    clockSlots = [0, 1].map(i => {
        const city = cities[i] || '—';
        const nameEl = $(i === 0 ? '#city-a' : '#city-b');
        if (nameEl) nameEl.textContent = String(city).toUpperCase();
        return { city, tz: null, geo: null, fmt: null, el: null };
    });
    tick();
    if (isPageActive()) tickTimer = setInterval(tick, 1000);
    (async () => {
        await Promise.all(clockSlots.map(async sl => {
            sl.geo = await geocode(sl.city);
            sl.tz = sl.geo?.tz || null;
            sl.fmt = null;
        }));
        if (gen !== clockGen) return;
        clocksReady = true;
        lastWxAt = 0;
        tick();
        if (isPageActive()) {
            refreshWeather();
            wxTimer = setInterval(refreshWeather, WX_INTERVAL);
        }
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

const ICO_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICO_X = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICO_FILL = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7L7 17M7 9v8h8"/></svg>';
const ICO_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
let sugSel = -1;

function agoLabel(id) {
    const t = Number(id); if (!t || t > Date.now()) return '';
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'сейчас';
    if (m < 60) return m + ' мин';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' ч';
    const d = Math.floor(h / 24);
    return d < 30 ? d + ' дн' : '';
}

function svgEl(markup, cls, title) {
    const s = el('span', { class: cls, title }); s.innerHTML = markup; return s;
}

function markMatch(text, q) {
    const i = q ? text.toLowerCase().indexOf(q) : -1;
    if (i < 0) return text;
    return [text.slice(0, i), el('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length)];
}

function renderSuggest() {
    const box = suggestBox(), ul = suggestList(), inp = searchInput();
    if (!box || !ul || !inp) return;
    const raw = inp.value.trim(), q = raw.toLowerCase();
    const items = qHistory.filter(h => !q || h.q.toLowerCase().includes(q)).slice(0, 8);
    sugSel = -1;
    const rows = items.map(h => {
        const ago = agoLabel(h.id);
        const fill = svgEl(ICO_FILL, '', 'Вставить в поле');
        fill.addEventListener('click', e => { e.stopPropagation(); inp.value = h.q; inp.focus(); renderSuggest(); });
        const del = svgEl(ICO_X, 'del', 'Удалить');
        del.addEventListener('click', e => {
            e.stopPropagation();
            qHistory = qHistory.filter(x => x.id !== h.id);
            store.setHistory(qHistory); renderSuggest();
        });
        return el('li', { role: 'option', onclick: () => { inp.value = h.q; goSearch(); } },
                  svgEl(ICO_CLOCK, 'ico'), el('span', { class: 'q' }, markMatch(h.q, q)),
                  ago ? el('span', { class: 'ago' }, ago) : null, el('span', { class: 'act' }, fill, del));
    });
    // при наборе — первой строкой быстрое действие «Искать …»
    if (raw && !items.some(h => h.q === raw)) {
        rows.unshift(el('li', { class: 'go', role: 'option', onclick: goSearch },
                        svgEl(ICO_SEARCH, 'ico'), el('span', { class: 'q' }, 'Искать «' + raw + '»')));
    }
    ul.replaceChildren(...rows);
    const cnt = $('#sg-count'); if (cnt) cnt.textContent = String(items.length);
    box.hidden = rows.length === 0;
}

function moveSuggest(dir) {
    const box = suggestBox(); if (!box || box.hidden) return false;
    const lis = [...suggestList().children]; if (!lis.length) return false;
    sugSel = (sugSel + dir + lis.length) % lis.length;
    lis.forEach((li, i) => li.classList.toggle('sel', i === sugSel));
    lis[sugSel].scrollIntoView({ block: 'nearest' });
    return true;
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
    searchInput()?.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (moveSuggest(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault(); return; }
        if (e.key === 'Enter' && !e.isComposing) {
            const li = sugSel >= 0 && !suggestBox().hidden ? suggestList().children[sugSel] : null;
            if (li) { li.click(); return; }
            goSearch();
        }
        if (e.key === 'Escape') hideSuggest();
    });
    $('#search-go')?.addEventListener('click', goSearch);
    $('#clear-history')?.addEventListener('click', async () => { qHistory = []; await store.setHistory([]); renderSuggest(); });
    document.addEventListener('click', e => { if (!e.target.closest('.search-row')) hideSuggest(); });
}

/* ---------- 10. Категории и ярлыки ---------- */
let categories = [];
let scModal = { catId: null, scId: null };

/* Каждое сохранение вызывало отрисовку дважды (saveCats + storage.onChanged в той же вкладке),
   Теперь параллельные вызовы склеиваются в один (с повтором, если данные успели измениться). */
let catsRendering = null, catsDirty = false;
function renderCats() {
    if (catsRendering) { catsDirty = true; return catsRendering; }
    catsRendering = (async () => {
        try {
            do {
                catsDirty = false;
                categories = await store.getCategories();
                const wrap = $('#cats'); if (!wrap) return;
                wrap.innerHTML = '';
                const frag = document.createDocumentFragment();
                categories.forEach(cat => frag.append(buildCard(cat)));
                wrap.append(frag);
            } while (catsDirty);
        } finally { catsRendering = null; }
    })();
    return catsRendering;
}

function buildCard(cat) {
    const card = el('div', { class: 'cat-card', dataset: { id: cat.id } });

    let icoNode;
    if (cat.image) {
        icoNode = el('img', { class: 'cat-ico cat-ico-img', src: cat.image, alt: '', draggable: false,
            onerror: e => e.target.replaceWith(el('span', { class: 'cat-ico' }, cat.icon || '')) });
    } else {
        icoNode = el('span', { class: 'cat-ico' }, cat.icon || '');
    }

    const head = el('div', { class: 'cat-head' },
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
            const emojis = ['🌐','','🎮','💻','🛒','','','','🏠','','','💎','🚀','🎯','☕','','🌙','⭐','🎬',''];
            cat.icon = emojis[Math.floor(Math.random() * emojis.length)];
            saveCats();
            toast('Случайный эмодзи: ' + cat.icon);
        } else if (action === '7') {
            const customEmoji = prompt(
                'Введите свой эмодзи:\n\n' +
                'Примеры: 🚀 💡 🎧 🐱  🔒 ✨\n' +
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
    head.addEventListener('pointerdown', e => startCatDrag(e, card, head));
    card.addEventListener('dragover', e => {
        if (!dragState || dragState.type !== 'chip') return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', e => { if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over'); });
    card.addEventListener('drop', e => {
        const dr = dragState;
        if (!dr || dr.type !== 'chip') return;   // перенос категорий обрабатывает контейнер #cats
        e.preventDefault(); e.stopPropagation(); clearDrag();
        const t = e.target.closest && e.target.closest('.chip');
        let after = false;
        if (t) { const r = t.getBoundingClientRect(); after = e.clientX > r.left + r.width / 2; }
        moveChip(dr.catId, dr.id, cat.id, t && t.dataset.id, after);
    });
        const chips = el('div', { class: 'chips' });
        (cat.shortcuts || []).forEach((sc, si) => chips.append(buildChip(cat, sc, si)));
        card.append(head, chips);
        return card;
}

let dragState = null;
function clearDrag() {
    dragState = null;
    document.querySelectorAll('.dragging,.drag-over').forEach(n => n.classList.remove('dragging', 'drag-over'));
}

function buildChip(cat, sc, si) {
    const chip = el('div', { class: 'chip', draggable: true,
        onclick: e => {
            const u = normalizeUrl(sc.url); if (!u) return;
            if (e.ctrlKey || e.metaKey) window.open(u, '_blank', 'noopener');
            else location.href = u;
        },
        onauxclick: e => { if (e.button === 1) { const u = normalizeUrl(sc.url); if (u) window.open(u, '_blank', 'noopener'); } } });
    chip.style.animationDelay = `${si * 0.05}s`;
    let ico;
    if (sc.icon && (/^https?:/.test(sc.icon) || sc.icon.startsWith('data:')))
        ico = el('img', { src: sc.icon, alt: '', draggable: false, decoding: 'async', loading: 'lazy', onerror: e => e.target.replaceWith(el('span', {}, ((sc.title || '').trim()[0] || '🌐').toUpperCase())) });
    else if (sc.icon) ico = el('span', {}, sc.icon);
    else ico = el('img', { src: faviconOf(sc.url), alt: '', draggable: false, decoding: 'async', loading: 'lazy', onerror: e => e.target.replaceWith(el('span', {}, ((sc.title || '').trim()[0] || '🌐').toUpperCase())) });
    chip.append(
        el('div', { class: 'chip-ico' }, ico),
                el('div', { class: 'chip-name', title: sc.title }, sc.title)
    );
    chip.dataset.id = sc.id;
    chip.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); openScModal(cat.id, sc.id); });
    chip.addEventListener('dragstart', e => {
        e.stopPropagation();
        dragState = { type: 'chip', catId: cat.id, id: sc.id };
        e.dataTransfer.setData('text/plain', 'chip');
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => chip.classList.add('dragging'), 0); // не менять DOM синхронно: Chrome может отменить drag
    });
    chip.addEventListener('dragend', clearDrag);
    return chip;
}

async function saveCats() {
    await store.setCategories(categories);
    renderCats();
}

function moveChip(from, scId, to, targetId, after) {
    const s = categories.find(c => c.id === from), d = categories.find(c => c.id === to);
    if (!s || !d || targetId === scId || (from === to && !targetId)) return;
    const idx = s.shortcuts.findIndex(x => x.id === scId);
    if (idx === -1) return;
    const [sc] = s.shortcuts.splice(idx, 1);
    let pos = d.shortcuts.length;
    const t = targetId ? d.shortcuts.findIndex(x => x.id === targetId) : -1;
    if (t !== -1) pos = t + (after ? 1 : 0);
    d.shortcuts.splice(pos, 0, sc);
    saveCats();
}

/* Перенос категорий: карточки переставляются прямо под курсором (с плавной FLIP-анимацией),
   а порядок сохраняется один раз при отпускании. */
function flipReorder(wrap, mutate) {
    const cards = [...wrap.children];
    const first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
    mutate();
    for (const c of cards) {
        const a = first.get(c), b = c.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
                                { duration: animDur(180), easing: EASE });
    }
}

/* Перенос категории: тянем за шапку; под курсором — плейсхолдер, остальные карточки
   расступаются с FLIP-анимацией, порядок сохраняется один раз при отпускании. */
function startCatDrag(e, card, head) {
    if (e.button !== 0 || e.target.closest('.cat-add')) return;
    const wrap = card.parentElement, sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let on = false, ph = null, grab = null, fix = null, lock = 0;
    let ended = false;
    try { head.setPointerCapture(pid); } catch {}

    const move = ev => {
        if (ev.pointerId !== pid || ended) return;
        const x = ev.clientX, y = ev.clientY;
        if (!on) {
            if (Math.hypot(x - sx, y - sy) < 6) return;
            on = true;
            const r = card.getBoundingClientRect();
            grab = { x: sx - r.left, y: sy - r.top };
            ph = el('div', { class: 'cat-ph' });
            ph.style.height = r.height + 'px';
            card.before(ph);
            card.classList.add('dragging');
            Object.assign(card.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
                                        height: r.height + 'px', zIndex: 60, pointerEvents: 'none', margin: 0 });
            const r2 = card.getBoundingClientRect();           // если у предка есть transform — компенсируем сдвиг
            fix = { x: r2.left - r.left, y: r2.top - r.top };
            document.body.classList.add('cat-dragging');
        }
        card.style.left = (x - grab.x - fix.x) + 'px';
        card.style.top = (y - grab.y - fix.y) + 'px';
        if (y < 70) window.scrollBy(0, -14); else if (y > innerHeight - 70) window.scrollBy(0, 14);
        if (performance.now() < lock) return;
        const t = [...wrap.children].find(n => {
            if (n === card || n === ph) return false;
            const q = n.getBoundingClientRect();
            return x >= q.left && x <= q.right && y >= q.top && y <= q.bottom;
        });
        if (!t) return;
        lock = performance.now() + 180;
        flipReorder(wrap, () => (ph.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) ? t.after(ph) : t.before(ph));
    };

    const end = (ev, cancel) => {
        if (ev.pointerId !== pid) return;
        ended = true;
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', cancelUp);
        try { head.releasePointerCapture(pid); } catch {}
        if (!on) return;
        document.body.classList.remove('cat-dragging');
        const from = card.getBoundingClientRect();
        for (const p of ['position', 'left', 'top', 'width', 'height', 'zIndex', 'pointerEvents', 'margin']) card.style[p] = '';
        card.classList.remove('dragging');
        if (cancel) { ph.remove(); return; }
        ph.replaceWith(card);
        const to = card.getBoundingClientRect();
        card.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px)` }, { transform: 'none' }],
                     { duration: animDur(160), easing: EASE });
        const byId = new Map(categories.map(c => [c.id, c]));
        const next = [...wrap.children].map(n => byId.get(n.dataset.id)).filter(Boolean);
        if (next.length === categories.length && next.some((c, i) => c !== categories[i])) { categories = next; saveCats(); }
    };
    const up = ev => end(ev, false), cancelUp = ev => end(ev, true);
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', cancelUp);
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
        const sc = cat?.shortcuts.find(x => x.id === scModal.scId);
        if (!sc || !confirm(`Удалить ярлык «${sc.title || sc.url}»?`)) return;
        cat.shortcuts = cat.shortcuts.filter(x => x.id !== scModal.scId);
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
        const emojis = ['🌐','','','💻','','','🎨','','',''];
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
const val = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; if (e.type === 'range') paintRange(e); } };
/* Заливка трека слайдера до текущего значения (переменная --p) */
function paintRange(e) {
    const mn = +e.min || 0, mx = +e.max || 100;
    e.style.setProperty('--p', ((e.value - mn) / (mx - mn || 1) * 100) + '%');
}
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
    const parse = e => step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    const save = debounce(v => {
        const parts = path.split('.');
        if (parts.length === 1) updateAppearanceSetting(parts[0], v);
        else updateAppearanceSetting(parts[0], prev => ({ ...prev, [parts[1]]: v }));
    }, 100);
    on(inputId, 'input', e => {
        const v = parse(e);
        txt(valueId, v + suffix);   // подпись обновляется сразу, запись и применение стилей - с задержкой
        save(v);
    });
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

/* ---------- 11.1. Синхронизация UI настроек ---------- */
function syncSettingsUI(s) {
    const d = DEFAULT_SETTINGS.appearance;
    val('theme-select', s.theme || 'rose');
    val('set-title', s.title || '');
    val('set-subtitle', s.subtitle || '');
    val('set-city-a', s.cities?.[0] || '');
    val('set-city-b', s.cities?.[1] || '');

    const bg = s.bg || {};
    val('set-bg-type', bg.type || 'none');
    val('set-bg-url', bg.url || '');
    val('set-bg-opacity', bg.opacity ?? 100); txt('set-bg-opacity-val', (bg.opacity ?? 100) + '%');
   

    const app = s.appearance || {};
    val('set-panel-opacity', app.panelOpacity ?? d.panelOpacity); txt('set-panel-opacity-val', (app.panelOpacity ?? d.panelOpacity) + '%');
    val('set-card-opacity', app.cardOpacity ?? d.cardOpacity); txt('set-card-opacity-val', (app.cardOpacity ?? d.cardOpacity) + '%');
    setSlider('set-panel-blur', app.panelBlur ?? d.panelBlur, 'set-panel-blur-val', 'px');
    setSlider('set-history-blur', app.historyBlur ?? d.historyBlur, 'set-history-blur-val', 'px');
    setSlider('set-history-opacity', app.historyOpacity ?? d.historyOpacity, 'set-history-opacity-val', '%');
    setSlider('set-settings-opacity', app.settingsOpacity ?? d.settingsOpacity, 'set-settings-opacity-val', '%');
    setSlider('set-settings-blur', app.settingsBlur ?? d.settingsBlur, 'set-settings-blur-val', 'px');

    const r = app.radius || {};
    setSlider('set-radius-panel', r.panel ?? d.radius.panel, 'set-radius-panel-val', 'px');
    setSlider('set-radius-card', r.card ?? d.radius.card, 'set-radius-card-val', 'px');
    setSlider('set-radius-button', r.button ?? d.radius.button, 'set-radius-button-val', 'px');
    setSlider('set-radius-chip', r.chip ?? d.radius.chip, 'set-radius-chip-val', 'px');
    setSlider('set-radius-input', r.input ?? d.radius.input, 'set-radius-input-val', 'px');

    const f = app.font || {};
    const fam = $('#set-font-family');
    if (fam) fam.value = f.family || d.font.family;
    setSlider('set-font-size', f.size ?? d.font.size, 'set-font-size-val', 'px');
    setSlider('set-font-weight', f.weight ?? d.font.weight, 'set-font-weight-val', '');
    setSlider('set-line-height', f.lineHeight ?? d.font.lineHeight, 'set-line-height-val', '');
    setSlider('set-ls', f.letterSpacing ?? d.font.letterSpacing, 'set-ls-val', 'em');
    setSlider('set-ls-title', f.titleSpacing ?? d.font.titleSpacing, 'set-ls-title-val', 'em');
    setSlider('set-ls-sub', f.subtitleSpacing ?? d.font.subtitleSpacing, 'set-ls-sub-val', 'em');

    const anim = document.getElementById('set-animations');
    if (anim) anim.checked = app.animations !== false;
    setSlider('set-transition-speed', app.transitionSpeed ?? d.transitionSpeed, 'set-transition-speed-val', 's');

    const cc = (s.customColor || '#ff4fa3').toLowerCase();
    val('set-custom-color', cc);
    val('set-custom-hex', cc);
}

/* ---------- 11.2. Применить ВСЁ из store к DOM ---------- */
async function applyEverything() {
    const s = await store.getSettings();
    await applyTheme(s.theme, false);
    applyAppearance(s.appearance);
    await applyBackground(s);
    paintTitle(s);
    const sub = $('#subtitle'); if (sub) sub.textContent = s.subtitle || '';
    paintAvatar(s.avatar || '');
    initThemeSelector(s.theme);
    qHistory = await store.getHistory();
    paintEngine();
    initClocks(s);
    await renderCats();
    currentSettings = s;
    syncSettingsUI(s);
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

    bindSlider('set-panel-opacity', 'panelOpacity', 'set-panel-opacity-val', '%');
    bindSlider('set-card-opacity', 'cardOpacity', 'set-card-opacity-val', '%');
    bindSlider('set-panel-blur', 'panelBlur', 'set-panel-blur-val', 'px');
    bindSlider('set-history-blur', 'historyBlur', 'set-history-blur-val', 'px');
    bindSlider('set-history-opacity', 'historyOpacity', 'set-history-opacity-val', '%');
    bindSlider('set-settings-opacity', 'settingsOpacity', 'set-settings-opacity-val', '%');
    bindSlider('set-settings-blur', 'settingsBlur', 'set-settings-blur-val', 'px');
    bindSlider('set-radius-panel', 'radius.panel', 'set-radius-panel-val', 'px');
    bindSlider('set-radius-card', 'radius.card', 'set-radius-card-val', 'px');
    bindSlider('set-radius-button', 'radius.button', 'set-radius-button-val', 'px');
    bindSlider('set-radius-chip', 'radius.chip', 'set-radius-chip-val', 'px');
    bindSlider('set-radius-input', 'radius.input', 'set-radius-input-val', 'px');
    on('set-font-family', 'change', e => updateAppearanceSetting('font', prev => ({ ...prev, family: e.target.value })));
    bindSlider('set-font-size', 'font.size', 'set-font-size-val', 'px');
    bindSlider('set-font-weight', 'font.weight', 'set-font-weight-val', '');
    bindSlider('set-line-height', 'font.lineHeight', 'set-line-height-val', '', 0.1);
    bindSlider('set-ls', 'font.letterSpacing', 'set-ls-val', 'em', 0.01);
    bindSlider('set-ls-title', 'font.titleSpacing', 'set-ls-title-val', 'em', 0.01);
    bindSlider('set-ls-sub', 'font.subtitleSpacing', 'set-ls-sub-val', 'em', 0.01);
    on('set-animations', 'change', e => updateAppearanceSetting('animations', e.target.checked));
    bindSlider('set-transition-speed', 'transitionSpeed', 'set-transition-speed-val', 's', 0.01);
    // заливка трека для всех слайдеров окна настроек одним делегированным обработчиком
    document.getElementById('settings-overlay')?.addEventListener('input', e => { if (e.target.type === 'range') paintRange(e.target); });

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

    /* ====== ЭКСПОРТ: всегда полный профиль (настройки, категории, картинки, история, фон) ====== */
    on('export-btn', 'click', async () => {
        try {
            let mediaBytes = 0;
            for (const key of await mediaKeys().catch(() => [])) mediaBytes += (await mediaGet(key).catch(() => null))?.size || 0;
            const mediaMB = mediaBytes / 1048576;
            // файл фона в base64 раздувается на треть; для очень тяжёлых видео спрашиваем
            let includeMedia = true;
            if (mediaMB > 30) {
                includeMedia = confirm(`Фоновый файл весит ~${mediaMB.toFixed(0)} МБ, экспорт получится очень большим.\n\nОК — экспортировать вместе с фоном\nОтмена — без файла фона (всё остальное сохранится)`);
            }
            const json = await store.exportAll({ includeMedia });
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `koch-brauzer-${includeMedia ? 'full' : 'no-bg'}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            const kb = Math.round(blob.size / 1024);
            toast(`Экспортировано (${kb >= 1024 ? (kb / 1024).toFixed(1) + ' МБ' : kb + ' КБ'})`);
        } catch (err) {
            console.error('[KOCH] export:', err);
            toast('Ошибка экспорта: ' + err.message, 'error');
        }
    });

    /* ====== ИМПОРТ: валидация + применение без перезагрузки ====== */
    on('import-btn', 'change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const text = await f.text();
            await store.importAll(text);
            invalidateRuntimeState();
            await applyEverything();
            toast('Настройки импортированы');
        } catch (err) {
            console.error('[KOCH] import:', err);
            toast('Ошибка импорта: ' + err.message, 'error');
        }
    });

    on('reset-btn', 'click', async () => {
        if (confirm('Сбросить все настройки и данные?')) {
            await store.reset();
            location.reload();
        }
    });
}

function setSlider(inputId, value, valueId, suffix) { val(inputId, value); txt(valueId, value + suffix); }

async function openSettings() {
    currentSettings = await store.getSettings();
    syncSettingsUI(currentSettings);
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

        setupVideoVisibility();

        initClocks(s);
        await Promise.all([initSearch(s), renderCats()]);
        bindAddCat(); bindScModal(); bindSettings(); bindKeys();

        let lastCities = JSON.stringify(s.cities || []);
        let lastBg = JSON.stringify(s.bg || {});
        const sync = debounce(async next => {
            if (!next) return;
            await applyTheme(next.theme, false);
            applyAppearance(next.appearance);
            // фон перечитывается (IndexedDB, видео) только если он действительно изменился
            const bgNow = JSON.stringify(next.bg || {});
            if (bgNow !== lastBg) { lastBg = bgNow; await applyBackground(next); }
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

/* Снимаем класс вступительной анимации: освобождает GPU-слои и не даёт анимации
   перезапускаться при перерисовке карточек (drag, правка категорий). */
setTimeout(() => document.documentElement.classList.remove('intro'), 1500);
