/* ============ KOCH BRAUZER ============ */

/* ---------- 1. Browser API ---------- */
const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
const isExt = !!(api && api.runtime && api.runtime.id);

const memFallback = new Map();
const safeLS = {
    get(k) { try { return localStorage.getItem(k); } catch { return memFallback.has(k) ? memFallback.get(k) : null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { memFallback.set(k, v); } },
    del(k) { try { localStorage.removeItem(k); } catch {} memFallback.delete(k); },
    clearKb() {
        try { Object.keys(localStorage).forEach(k => { if (k.startsWith('kb_')) localStorage.removeItem(k); }); }
        catch { for (const k of [...memFallback.keys()]) if (k.startsWith('kb_')) memFallback.delete(k); }
    }
};

const apiStorage = {
    async get(keys) {
        if (!isExt) {
            const r = {}, ka = Array.isArray(keys) ? keys : [keys];
            for (const k of ka) {
                const raw = safeLS.get('kb_' + k);
                if (raw !== null) { try { r[k] = JSON.parse(raw); } catch { r[k] = raw; } }
            }
            return r;
        }
        return api.storage.local.get(keys);
    },
    async set(items) {
        if (!isExt) {
            for (const [k, v] of Object.entries(items)) {
                safeLS.set('kb_' + k, JSON.stringify(v));
            }
            return;
        }
        return api.storage.local.set(items);
    },
    async clear() {
        if (!isExt) {
            safeLS.clearKb();
            return;
        }
        return api.storage.local.clear();
    },
    _listeners: [],
    _bound: false,
    onChanged(cb) {
        this._listeners.push(cb);
        if (this._bound) return;
        this._bound = true;
        const dispatch = (changes, area) => {
            for (const fn of this._listeners) fn(changes, area);
        };
        if (!isExt) {
            window.addEventListener('storage', e => {
                if (!e.key || !e.key.startsWith('kb_')) return;
                let nv; try { nv = JSON.parse(e.newValue); } catch { nv = e.newValue; }
                dispatch({ [e.key.slice(3)]: { newValue: nv } }, 'local');
            });
            return;
        }
        api.storage.onChanged.addListener(dispatch);
    }
};

/* ---------- 2. Утилиты ---------- */
const $ = (s, c = document) => c.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function clone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) {
        const a = new Array(o.length);
        for (let i = 0; i < o.length; i++) a[i] = clone(o[i]);
        return a;
    }
    const r = {};
    for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = clone(o[k]);
    return r;
}
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
    let t = 0, lastArgs = null;
    const d = (...a) => { lastArgs = a; clearTimeout(t); t = setTimeout(() => { t = 0; const args = lastArgs; lastArgs = null; fn(...args); }, ms); };
    d.cancel = () => { clearTimeout(t); t = 0; lastArgs = null; };
    d.flush = () => { if (t) { const args = lastArgs; d.cancel(); fn(...args); } };
    return d;
};
const pendingSaves = new Set();
const saveDebounced = (fn, ms = 200) => { const d = debounce(fn, ms); pendingSaves.add(d); return d; };
const flushPendingSaves = () => pendingSaves.forEach(d => d.flush());
const cancelPendingSaves = () => pendingSaves.forEach(d => d.cancel());

function toast(msg, type = 'info') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const cls = type === 'error' ? 'toast toast-error' : 'toast';
    const last = box.lastElementChild;
    if (last && last.textContent === msg && last.className === cls && !last.classList.contains('out')) {
        clearTimeout(last._t);
        const dur = animDur(160);
        if (dur) last.animate?.([{ transform: 'scale(1.045)' }, { transform: 'none' }], { duration: dur, easing: EASE });
        last._t = setTimeout(() => { last.classList.add('out'); setTimeout(() => last.remove(), 320); }, 2600);
        return;
    }
    while (box.children.length >= 4) box.firstElementChild.remove();
    const t = el('div', { class: cls }, msg);
    box.append(t);
    t._t = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
}

const favCache = new Map();
const isIconUrl = s => typeof s === 'string' && /^(https?:|data:)/i.test(s);
function faviconOf(url) {
    if (!url) return '';
    if (favCache.has(url)) return favCache.get(url);
    try {
        const u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
        if (!u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost')) return '';
        const res = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
        if (favCache.size >= 200) favCache.delete(favCache.keys().next().value);
        favCache.set(url, res);
        return res;
    } catch { return ''; }
}
function faviconFallbackOf(url) {
    if (!url) return '';
    try {
        const u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
        if (!u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost')) return '';
        return `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
    } catch { return ''; }
}
function onFavError(e, rawUrl, makeFallbackNode) {
    const img = e.target;
    if (!img.dataset.fbTried) {
        img.dataset.fbTried = '1';
        const alt = faviconFallbackOf(rawUrl);
        if (alt && img.src !== alt) { img.src = alt; return; }
    }
    img.replaceWith(makeFallbackNode());
}

function normalizeUrl(str) {
    str = (str || '').trim();
    if (!str) return '';
    try {
        if (/^https?:\/\//i.test(str)) {
            const u = new URL(str);
            return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname ? str : '';
        }
        if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([\/?#]|$)/i.test(str)) return 'http://' + str;
        // домен вида name.tld: зона обязана начинаться с буквы (поддерживаются и IDN, например .рф)
        if (!/\s/.test(str) && /^[^\s\/?#]+\.\p{L}[\p{L}\d-]*(?::\d+)?(?:[\/?#]|$)/u.test(str)) {
            const u = new URL('https://' + str);
            return u.hostname ? 'https://' + str : '';
        }
    } catch { return ''; }
    return '';
}

/* ---------- 3. Цвет: HEX <-> HSL ---------- */
function hexToRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
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
    smartGreeting: false,
    cities: ['Воткинск', 'Уральск'],
    clockFormat: '24h',
    clockSeconds: true,
    clockDate: false,
    hideClocks: false,
    wxUnit: 'C',
    wxDetails: false,
    avatar: '',
    engine: 'google',
    openInNewTab: false,
    autoFocusSearch: false,
    searchShortcuts: true,
    saveSearchHistory: true,
    numHotkeys: false,
    hideChipNames: false,
    hideAvatar: false,
    hideHeroText: false,
    chipStyle: 'cards',
    catColumns: 'auto',
    hideAddCat: false,
    bg: { type: 'none', url: '', idb: '', opacity: 100, dim: 56, blur: 0, scale: 100, brightness: 100, contrast: 100, saturate: 100 },
    appearance: {
        panelOpacity: 30, cardOpacity: 45,
        panelBlur: 8, historyBlur: 14, historyOpacity: 78, settingsOpacity: 76, settingsBlur: 14,
        panelWidth: 1180, panelPad: 28, panelMargin: 88, cardPad: 15, gridGap: 15, chipGap: 10,
        chipMin: 84, searchWidth: 100, searchHeight: 54,
        avatarSize: 96, iconSize: 40, titleSize: 47, subSize: 13, clockSize: 29, chipFont: 12,
        radius: { card: 18, panel: 26, button: 10, chip: 12, input: 10, search: 50, avatar: 50 },
        font: { family: "'Product Sans','Product Sans Regular',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif", size: 16, weight: 400, lineHeight: 1, letterSpacing: 0, titleSpacing: 0.14, subtitleSpacing: 0.12 },
        animations: true, cursorGlow: true, transitionSpeed: 0.28
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

const CURRENT_SCHEMA = 10;
const PROFILE_FORMAT_VERSION = 3;
const MEDIA_KEY = 'bg-media';
let settingsCache = null;
const EASE = 'cubic-bezier(.16,1,.3,1)';
function animDur(ms) { return document.documentElement.classList.contains('reduce-motion') ? 0 : ms; }

/* ---------- 5. Нормализация и миграция ---------- */
function normalizeBg(bg) {
    bg = bg && typeof bg === 'object' ? bg : {};
    return {
        type: ['none', 'image', 'video'].includes(bg.type) ? bg.type : 'none',
        url: typeof bg.url === 'string' ? bg.url : '',
        idb: typeof bg.idb === 'string' ? bg.idb : '',
        opacity: num(bg.opacity, 100, 0, 100),
        dim: num(bg.dim, 56, 0, 90),
        blur: num(bg.blur, 0, 0, 24),
        scale: num(bg.scale, 100, 100, 130),
        brightness: num(bg.brightness, 100, 20, 160),
        contrast: num(bg.contrast, 100, 50, 160),
        saturate: num(bg.saturate, 100, 0, 200)
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
        panelWidth: num(app.panelWidth, d.panelWidth, 860, 1600),
        panelPad: num(app.panelPad, d.panelPad, 16, 48),
        panelMargin: num(app.panelMargin, d.panelMargin, 48, 180),
        cardPad: num(app.cardPad, d.cardPad, 10, 28),
        gridGap: num(app.gridGap, d.gridGap, 8, 28),
        chipGap: num(app.chipGap, d.chipGap, 4, 20),
        chipMin: num(app.chipMin, d.chipMin, 64, 130),
        searchWidth: num(app.searchWidth, d.searchWidth, 50, 100),
        searchHeight: num(app.searchHeight, d.searchHeight, 44, 68),
        avatarSize: num(app.avatarSize, d.avatarSize, 56, 148),
        iconSize: num(app.iconSize, d.iconSize, 24, 56),
        titleSize: num(app.titleSize, d.titleSize, 24, 64),
        subSize: num(app.subSize, d.subSize, 10, 22),
        clockSize: num(app.clockSize, d.clockSize, 20, 46),
        chipFont: num(app.chipFont, d.chipFont, 10, 16),
        radius: {
            card: num(r.card, d.radius.card, 0, 50),
            panel: num(r.panel, d.radius.panel, 0, 50),
            button: num(r.button, d.radius.button, 0, 50),
            chip: num(r.chip, d.radius.chip, 0, 50),
            input: num(r.input, d.radius.input, 0, 50),
            search: num(r.search, d.radius.search, 8, 50),
            avatar: num(r.avatar, d.radius.avatar, 0, 50)
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
        cursorGlow: typeof app.cursorGlow === 'boolean' ? app.cursorGlow : true,
        transitionSpeed: num(app.transitionSpeed, d.transitionSpeed, 0, 2)
    };
}

function normalizeSettings(s) {
    s = s && typeof s === 'object' ? s : {};
    const d = DEFAULT_SETTINGS;
    return {
        theme: typeof s.theme === 'string' && THEMES[s.theme] ? s.theme : d.theme,
        customColor: typeof s.customColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.customColor) ? s.customColor.toLowerCase() : d.customColor,
        title: typeof s.title === 'string' ? s.title.slice(0, 40) : d.title,
        subtitle: typeof s.subtitle === 'string' ? s.subtitle.slice(0, 60) : d.subtitle,
        smartGreeting: typeof s.smartGreeting === 'boolean' ? s.smartGreeting : d.smartGreeting,
        cities: Array.isArray(s.cities) ? [typeof s.cities[0] === 'string' ? s.cities[0] : '', typeof s.cities[1] === 'string' ? s.cities[1] : ''] : d.cities.slice(),
        clockFormat: s.clockFormat === '12h' ? '12h' : '24h',
        clockSeconds: typeof s.clockSeconds === 'boolean' ? s.clockSeconds : d.clockSeconds,
        clockDate: typeof s.clockDate === 'boolean' ? s.clockDate : d.clockDate,
        hideClocks: typeof s.hideClocks === 'boolean' ? s.hideClocks : d.hideClocks,
        wxUnit: s.wxUnit === 'F' ? 'F' : 'C',
        wxDetails: typeof s.wxDetails === 'boolean' ? s.wxDetails : d.wxDetails,
        avatar: typeof s.avatar === 'string' ? s.avatar : d.avatar,
        engine: typeof s.engine === 'string' && ENGINES[s.engine] ? s.engine : d.engine,
        openInNewTab: typeof s.openInNewTab === 'boolean' ? s.openInNewTab : d.openInNewTab,
        autoFocusSearch: typeof s.autoFocusSearch === 'boolean' ? s.autoFocusSearch : d.autoFocusSearch,
        searchShortcuts: typeof s.searchShortcuts === 'boolean' ? s.searchShortcuts : d.searchShortcuts,
        saveSearchHistory: typeof s.saveSearchHistory === 'boolean' ? s.saveSearchHistory : d.saveSearchHistory,
        numHotkeys: typeof s.numHotkeys === 'boolean' ? s.numHotkeys : d.numHotkeys,
        hideChipNames: typeof s.hideChipNames === 'boolean' ? s.hideChipNames : d.hideChipNames,
        hideAvatar: typeof s.hideAvatar === 'boolean' ? s.hideAvatar : d.hideAvatar,
        hideHeroText: typeof s.hideHeroText === 'boolean' ? s.hideHeroText : d.hideHeroText,
        chipStyle: s.chipStyle === 'compact' ? 'compact' : 'cards',
        catColumns: ['auto', '2', '3', '4'].includes(String(s.catColumns)) ? String(s.catColumns) : 'auto',
        hideAddCat: typeof s.hideAddCat === 'boolean' ? s.hideAddCat : d.hideAddCat,
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
    if (ver < 7) {
        const a = m.appearance, d = DEFAULT_SETTINGS.appearance;
        if (a.panelBlur === 10) a.panelBlur = d.panelBlur;
        if (a.historyBlur === 12) a.historyBlur = d.historyBlur;
        if (a.historyOpacity === 80) a.historyOpacity = d.historyOpacity;
        if (a.settingsOpacity === 88) a.settingsOpacity = d.settingsOpacity;
        if (a.settingsBlur === 14) a.settingsBlur = d.settingsBlur;
    }
    return m;
}

function normalizeCategories(cats) {
    if (cats && !Array.isArray(cats) && typeof cats === 'object') cats = Object.values(cats);
    if (!Array.isArray(cats)) return [];
    const str = (...v) => { for (const x of v) if (typeof x === 'string' && x) return x; return ''; };
    const idStr = v => (typeof v === 'string' && v) ? v : (typeof v === 'number' ? String(v) : '');
    const usedC = new Set(), usedS = new Set();
    const uniq = (id, set) => { if (!id || set.has(id)) id = uid(); set.add(id); return id; };
    return cats.map(c => {
        if (!c || typeof c !== 'object') return null;
        const list = [c.shortcuts, c.links, c.items, c.tiles, c.sites, c.bookmarks].find(Array.isArray) || [];
        return {
            id: uniq(idStr(c.id), usedC),
            icon: str(c.icon, c.emoji),
            image: str(c.image, c.img),
            name: str(c.name, c.title) || 'Category',
            shortcuts: list.map(x => {
                if (typeof x === 'string') x = { url: x, title: x };
                if (!x || typeof x !== 'object') return null;
                return {
                    id: uniq(idStr(x.id), usedS),
                    title: str(x.title, x.name, x.label),
                    url: str(x.url, x.href, x.link),
                    icon: str(x.icon, x.image, x.favicon)
                };
            }).filter(Boolean)
        };
    }).filter(Boolean);
}

const HISTORY_LIMIT = 50;

function normalizeHistory(h) {
    if (!Array.isArray(h)) return [];
    return h.map(x => ({
        id: (typeof x?.id === 'string' && x.id) ? x.id : (typeof x?.id === 'number' ? String(x.id) : uid()),
        q: typeof x?.q === 'string' ? x.q : ''
    })).filter(x => x.q).slice(0, HISTORY_LIMIT);
}

/* Ключи настроек, по которым узнаётся очень старый бэкап, где настройки лежали прямо в корне файла. */
const SETTINGS_KEYS = [
    'theme', 'customColor', 'title', 'subtitle', 'smartGreeting', 'cities',
    'clockFormat', 'clockSeconds', 'clockDate', 'hideClocks', 'wxUnit', 'wxDetails', 'avatar', 'engine',
    'openInNewTab', 'autoFocusSearch', 'searchShortcuts', 'saveSearchHistory', 'numHotkeys', 'hideChipNames', 'hideAvatar', 'hideHeroText', 'chipStyle', 'catColumns', 'hideAddCat',
    'bg', 'appearance'
];

function migrateBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Файл не похож на бэкап KOCH BRAUZER');
    const p = data.format === 'koch-brauzer-profile' && data.profile && typeof data.profile === 'object' ? data.profile : data;
    const rawSettings = p.settings && typeof p.settings === 'object' ? p.settings : (SETTINGS_KEYS.some(k => k in p) ? p : null);
    const rawCats = p.categories ?? p.data?.categories ?? p.settings?.categories;
    if (!rawSettings && rawCats == null && !Array.isArray(p.history)) throw new Error('Файл не похож на бэкап KOCH BRAUZER');
    return {
        settings: rawSettings ? normalizeSettings(rawSettings) : null,
        categories: rawCats == null ? null : normalizeCategories(rawCats),
        history: Array.isArray(p.history) ? normalizeHistory(p.history) : null,
        media: Array.isArray(p.media) ? p.media.filter(m => m && m.id && m.data) : []
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

async function mediaTx(mode, run) {
    if (mode === 'readwrite') bgMediaSig = '';
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('media', mode);
        const req = run(tx.objectStore('media'));
        if (mode === 'readonly') {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } else {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
        }
    });
}
const mediaPut = (key, blob) => mediaTx('readwrite', s => s.put(blob, key));
const mediaGet = key => mediaTx('readonly', s => s.get(key)).then(r => r || null);
const mediaDel = key => mediaTx('readwrite', s => s.delete(key));
const mediaKeys = () => mediaTx('readonly', s => s.getAllKeys()).then(r => r || []);

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

async function base64ToBlob(dataUrl, mime) {
    if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) throw new Error('Invalid data URL');
    const blob = await (await fetch(dataUrl)).blob();
    return blob.slice(0, blob.size, mime || 'application/octet-stream');
}

async function compressImageBlob(blob, maxWidth = 1920) {
    if (!blob.type || !blob.type.startsWith('image/') || blob.type === 'image/gif' || blob.type === 'image/svg+xml' || blob.size < 512 * 1024) return blob;
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / Math.max(img.width || maxWidth, img.height || maxWidth));
            if (scale >= 1 && blob.size < 1536 * 1024) { URL.revokeObjectURL(url); resolve(blob); return; }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(b => {
                canvas.width = canvas.height = 0;
                URL.revokeObjectURL(url);
                resolve(b && b.size < blob.size ? b : blob);
            }, 'image/webp', 0.88);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
        img.src = url;
    });
}

async function importMedia(list) {
    if (!Array.isArray(list)) return;
    for (const m of list) {
        if (!m || !m.id || !m.data) continue;
        try { await mediaPut(m.id, await base64ToBlob(m.data, m.mime)); }
        catch (err) { console.warn('[KOCH] importMedia:', m.id, err); }
    }
}

/* ---------- Store ---------- */
const store = {
    sig: '',
    catsSig: '',
    histSig: '',
    async _settingsFrom(data) {
        let s = data.settings;
        const ver = data.schemaVersion || 1;
        if (ver < CURRENT_SCHEMA || !s) {
            s = migrateSettings(s, ver);
            await apiStorage.set({ settings: s, schemaVersion: CURRENT_SCHEMA });
        }
        s = normalizeSettings(s);
        settingsCache = s;
        return clone(s);
    },
    async getSettings() {
        if (settingsCache) return clone(settingsCache);
        return this._settingsFrom(await apiStorage.get(['settings', 'schemaVersion']));
    },
    async boot() {
        const d = await apiStorage.get(['settings', 'schemaVersion', 'categories', 'history']);
        const settings = await this._settingsFrom(d);
        this.sig = JSON.stringify(settings);
        const categories = Array.isArray(d.categories) ? normalizeCategories(d.categories) : clone(DEFAULT_CATEGORIES);
        this.catsSig = JSON.stringify(categories);
        const history = Array.isArray(d.history) ? normalizeHistory(d.history) : [];
        this.histSig = JSON.stringify(history);
        return { settings, categories, history };
    },
    async setSettings(s, inv = true) {
        if (inv) settingsCache = s;
        this.sig = JSON.stringify(s);
        await apiStorage.set({ settings: s });
    },
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
    async getCategories() {
        const d = await apiStorage.get('categories');
        return Array.isArray(d.categories) ? normalizeCategories(d.categories) : clone(DEFAULT_CATEGORIES);
    },
    async setCategories(c) {
        this.catsSig = JSON.stringify(c);
        await apiStorage.set({ categories: c });
    },
    async getHistory() {
        const d = await apiStorage.get('history');
        return Array.isArray(d.history) ? normalizeHistory(d.history) : [];
    },
    async setHistory(h) {
        this.histSig = JSON.stringify(h);
        await apiStorage.set({ history: h });
    },
    onSettingsChange(cb) {
        apiStorage.onChanged((changes, area) => {
            if (area === 'local' && changes.settings) {
                const next = changes.settings.newValue ? normalizeSettings(changes.settings.newValue) : null;
                const sig = next ? JSON.stringify(next) : '';
                if (sig && sig === this.sig) return;
                settingsCache = next;
                cb(next ? clone(next) : null);
            }
        });
    },
    onCategoriesChange(cb) {
        apiStorage.onChanged((changes, area) => {
            if (area === 'local' && changes.categories) {
                const next = Array.isArray(changes.categories.newValue) ? normalizeCategories(changes.categories.newValue) : [];
                const sig = JSON.stringify(next);
                if (sig === this.catsSig) return;
                this.catsSig = sig;
                cb(next);
            }
        });
    },
    async reset() {
        settingsCache = null;
        this.sig = '';
        this.catsSig = '';
        this.histSig = '';
        await apiStorage.clear();
        try { for (const k of await mediaKeys()) await mediaDel(k); } catch (err) { console.warn('[KOCH] reset media:', err); }
        wxStore.clear();
    },

    async exportAll(opts = {}) {
        const { includeMedia = true } = opts;
        await this._q;
        const data = await apiStorage.get(['settings', 'categories', 'history']);
        const settings = normalizeSettings(data.settings);
        const cats = data.categories || clone(DEFAULT_CATEGORIES);
        let media = [];
        if (includeMedia && settings.bg?.type !== 'none' && settings.bg?.idb) {
            try {
                const blob = await mediaGet(settings.bg.idb);
                if (blob) {
                    media.push({ id: settings.bg.idb, mime: blob.type || '', size: blob.size || 0, data: await blobToBase64(blob) });
                }
            } catch (err) { console.warn('[KOCH] exportMedia:', err); }
        }

        const profile = {
            format: 'koch-brauzer-profile',
            version: PROFILE_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            profile: {
                settings,
                categories: normalizeCategories(cats),
                history: normalizeHistory(data.history),
                media
            }
        };
        return JSON.stringify(profile);
    },

    async importAll(json) {
        let data;
        try { data = JSON.parse(json); } catch { throw new Error('Невалидный JSON'); }
        if (!data || typeof data !== 'object') throw new Error('Файл не похож на бэкап');

        await this._q;
        const migrated = migrateBackup(data);

        if (migrated.media.length > 0) await importMedia(migrated.media);

        const bg = migrated.settings?.bg;
        if (bg) {
            if (!bg.idb) {
                try { for (const k of await mediaKeys()) await mediaDel(k); } catch {}
            } else if (!migrated.media.some(m => m.id === bg.idb) && !(await mediaGet(bg.idb).catch(() => null))) {
                bg.idb = '';
                if (!bg.url) bg.type = 'none';
            }
        }

        const next = { schemaVersion: CURRENT_SCHEMA };
        for (const k of ['settings', 'categories', 'history']) if (migrated[k]) next[k] = migrated[k];
        if (migrated.settings) this.sig = JSON.stringify(migrated.settings);
        if (migrated.categories) this.catsSig = JSON.stringify(migrated.categories);
        if (migrated.history) this.histSig = JSON.stringify(migrated.history);
        await apiStorage.set(next);
        settingsCache = migrated.settings ? clone(migrated.settings) : null;
        return migrated;
    }
};

/* ---------- 7. Темы ---------- */
const THEMES = {
    rose: 'Розовая', purple: 'Фиолетовая', ocean: 'Океан', green: 'Изумруд',
    dark: 'Тёмная', light: 'Светлая', midnight: 'Полночь', sunset: 'Закат',
    custom: 'Своя'
};
const THEME_SWATCH_COLORS = {
    rose: '#ff4fa3', purple: '#a855f7', ocean: '#38bdf8', green: '#34d399',
    dark: '#64748b', light: '#e2e8f0', midnight: '#60a5fa', sunset: '#fb923c',
    custom: 'conic-gradient(from 0deg, #ff4fa3, #a855f7, #38bdf8, #34d399, #fb923c, #ff4fa3)'
};

let appliedTheme = null, bgObjectUrl = null;

function applyCustomThemeVars(hex) {
    const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : '#ff4fa3';
    const { r, g, b } = hexToRgb(clean);
    const { h, s, l } = rgbToHsl(r, g, b);
    const cl = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

    const S = cl(s, 30, 90);
    const L = cl(l, 15, 85);
    const d = L / 60;

    const bg      = hslHex(h, S * 0.55, cl(4 * d, 2, 12));
    const panel   = hslHex(h, S * 0.60, cl(8 * d, 4, 20));
    const card    = hslHex(h, S * 0.60, cl(11 * d, 6, 26));
    const card2   = hslHex(h, S * 0.60, cl(15 * d, 9, 32));
    const accent  = clean;
    const accent2 = hslHex(h, cl(S, 45, 92), cl(L + 16, 58, 88));
    const yellow  = hslHex((h + 50) % 360, 78, 72);
    const text    = hslHex(h, S * 0.28, 94);
    const muted   = hslHex(h, S * 0.45, cl(L * 0.75 + 22, 52, 74));

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

function syncThemeSwatches(activeId) {
    const wrap = $('#theme-swatches');
    if (!wrap) return;
    wrap.querySelectorAll('.swatch-btn').forEach(btn => {
        const isAct = btn.dataset.swatch === activeId;
        btn.classList.toggle('active', isAct);
        btn.setAttribute('aria-checked', String(isAct));
    });
}

async function applyTheme(id, persist = true, preloadedCustomColor = null) {
    if (!THEMES[id]) id = 'rose';
    if (id === appliedTheme && id !== 'custom' && !persist) return;
    appliedTheme = id;
    document.documentElement.dataset.theme = id;
    document.body.dataset.theme = id;
    syncThemeSwatches(id);
    const sel = $('#theme-select');
    if (sel && sel.value !== id) sel.value = id;

    const p = persist ? store.updateSettings(s => ({ ...s, theme: id })) : null;
    if (id === 'custom') {
        const customHex = preloadedCustomColor || (await (p || store.getSettings())).customColor || '#ff4fa3';
        if (appliedTheme === id) applyCustomThemeVars(customHex);
    } else {
        clearCustomThemeVars();
        if (p) await p;
    }
}

function applyAppearance(app) {
    if (!app) return;
    const d = DEFAULT_SETTINGS.appearance;
    const r = document.documentElement;
    r.style.setProperty('--panel-opacity', (app.panelOpacity ?? d.panelOpacity) / 100);
    r.style.setProperty('--card-opacity', (app.cardOpacity ?? d.cardOpacity) / 100);
    const pb = app.panelBlur ?? d.panelBlur;
    r.style.setProperty('--panel-blur', pb + 'px');
    r.style.setProperty('--panel-bf', pb > 0 ? `blur(${pb}px)` : 'none');
    r.classList.toggle('no-blur', pb <= 0);
    const hb = app.historyBlur ?? d.historyBlur;
    r.style.setProperty('--sg-bf', hb > 0 ? `blur(${hb}px)` : 'none');
    r.style.setProperty('--sg-op', (app.historyOpacity ?? d.historyOpacity) + '%');
    r.style.setProperty('--set-op', (app.settingsOpacity ?? d.settingsOpacity) + '%');
    const sb = app.settingsBlur ?? d.settingsBlur;
    r.style.setProperty('--set-bf', sb > 0 ? `blur(${sb}px)` : 'none');
    r.style.setProperty('--panel-width', (app.panelWidth ?? d.panelWidth) + 'px');
    r.style.setProperty('--panel-pad', (app.panelPad ?? d.panelPad) + 'px');
    r.style.setProperty('--panel-mt', (app.panelMargin ?? d.panelMargin) + 'px');
    r.style.setProperty('--card-pad', (app.cardPad ?? d.cardPad) + 'px');
    r.style.setProperty('--grid-gap', (app.gridGap ?? d.gridGap) + 'px');
    r.style.setProperty('--chip-gap', (app.chipGap ?? d.chipGap) + 'px');
    r.style.setProperty('--chip-min', (app.chipMin ?? d.chipMin) + 'px');
    r.style.setProperty('--search-width', (app.searchWidth ?? d.searchWidth) + '%');
    r.style.setProperty('--search-height', (app.searchHeight ?? d.searchHeight) + 'px');
    r.style.setProperty('--avatar-size', (app.avatarSize ?? d.avatarSize) + 'px');
    r.style.setProperty('--chip-ico-size', (app.iconSize ?? d.iconSize) + 'px');
    r.style.setProperty('--title-size', (app.titleSize ?? d.titleSize) + 'px');
    r.style.setProperty('--sub-size', (app.subSize ?? d.subSize) + 'px');
    r.style.setProperty('--clock-size', (app.clockSize ?? d.clockSize) + 'px');
    r.style.setProperty('--chip-font', (app.chipFont ?? d.chipFont) + 'px');
    if (app.radius) {
        r.style.setProperty('--radius-card', (app.radius.card ?? d.radius.card) + 'px');
        r.style.setProperty('--radius-panel', (app.radius.panel ?? d.radius.panel) + 'px');
        r.style.setProperty('--radius-button', (app.radius.button ?? d.radius.button) + 'px');
        r.style.setProperty('--radius-chip', (app.radius.chip ?? d.radius.chip) + 'px');
        r.style.setProperty('--radius-input', (app.radius.input ?? d.radius.input) + 'px');
        r.style.setProperty('--radius-search', (app.radius.search ?? d.radius.search) + 'px');
        r.style.setProperty('--radius-avatar', (app.radius.avatar ?? d.radius.avatar) + '%');
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
    r.classList.toggle('no-cursor-glow', app.cursorGlow === false);
}

const computeBgScale = (scale = 100, blur = 0) => Math.max(scale / 100, blur > 0 ? 1 + blur * 0.003 : 1);
function buildBgFilter(blur = 0, bright = 100, contrast = 100, sat = 100) {
    const p = [];
    if (blur > 0) p.push(`blur(${blur}px)`);
    if (bright !== 100) p.push(`brightness(${bright}%)`);
    if (contrast !== 100) p.push(`contrast(${contrast}%)`);
    if (sat !== 100) p.push(`saturate(${sat}%)`);
    return p.length ? p.join(' ') : 'none';
}

/* ---------- 7.1. Фон и управление видеодекодером ---------- */
let bgChain = Promise.resolve();
let bgMediaSig = '';
let bgVideoActive = false;
let bgVideoUrl = '';
let bgAppliedSig = '';
let pageGone = false;
let videoReleaseTimer = 0;

const isPageActive = () => !document.hidden && !pageGone;

function applyBackground(preloaded) {
    const run = bgChain.then(() => applyBackgroundNow(preloaded));
    bgChain = run.catch(err => console.warn('[KOCH] background:', err));
    return run;
}

function releaseVideo(v) {
    clearTimeout(videoReleaseTimer);
    videoReleaseTimer = 0;
    try { v.pause(); } catch {}
    if (v.hasAttribute('src')) {
        v.removeAttribute('src');
        try { v.load(); } catch {}
    }
    v.dataset.kbUrl = '';
}

function syncVideoPlayback() {
    const v = document.getElementById('bg-video');
    if (!v) return;
    clearTimeout(videoReleaseTimer);
    videoReleaseTimer = 0;

    if (bgVideoActive && bgVideoUrl && isPageActive()) {
        if (v.dataset.kbUrl !== bgVideoUrl) {
            v.dataset.kbUrl = bgVideoUrl;
            v.src = bgVideoUrl;
        }
        if (v.paused) v.play().catch(() => {});
    } else {
        if (!v.paused) {
            try { v.pause(); } catch {}
        }
        if (bgVideoActive && v.hasAttribute('src') && !isPageActive()) {
            videoReleaseTimer = setTimeout(() => {
                if (!isPageActive()) releaseVideo(v);
            }, 4000);
        }
    }
}

async function applyBackgroundNow(preloaded) {
    const s = preloaded || await store.getSettings();
    const bg = s.bg || { type: 'none', url: '', idb: '' };
    bgAppliedSig = JSON.stringify(bg);
    const v = document.getElementById('bg-video');
    const i = document.getElementById('bg-image');
    if (!v || !i) return;

    const root = document.documentElement;
    let url = (bg.type !== 'none') ? (bg.url || '') : '';
    let sig = url ? 'url:' + url : '';
    if (bg.type !== 'none' && bg.idb) {
        const idbSig = 'idb:' + bg.idb;
        if (bgMediaSig === idbSig && bgObjectUrl) {
            sig = idbSig;
            url = bgObjectUrl;
        } else {
            const blob = await mediaGet(bg.idb).catch(() => null);
            if (blob) {
                sig = idbSig;
                url = URL.createObjectURL(blob);
            }
        }
    }
    bgMediaSig = sig;
    if (bgObjectUrl && bgObjectUrl !== url) URL.revokeObjectURL(bgObjectUrl);
    bgObjectUrl = (url && url.startsWith('blob:')) ? url : null;

    const op = (bg.opacity ?? 100) / 100;
    const dimOp = (bg.dim ?? 56) / 100;
    const bgBlur = bg.blur ?? 0;
    const bgScale = bg.scale ?? 100;
    const bgBright = bg.brightness ?? 100;
    const bgContrast = bg.contrast ?? 100;
    const bgSat = bg.saturate ?? 100;
    const st = root.style;
    st.setProperty('--bg-opacity', op);
    st.setProperty('--bg-dim-op', dimOp);
    st.setProperty('--bg-blur', bgBlur + 'px');
    st.setProperty('--bg-bright', bgBright + '%');
    st.setProperty('--bg-contrast', bgContrast + '%');
    st.setProperty('--bg-sat', bgSat + '%');
    st.setProperty('--bg-bf', buildBgFilter(bgBlur, bgBright, bgContrast, bgSat));
    st.setProperty('--bg-scale', computeBgScale(bgScale, bgBlur));
    root.classList.toggle('bg-scaled', bgScale > 100 || bgBlur > 0);

    const hasMedia = (bg.type === 'video' || bg.type === 'image') && url;
    root.classList.toggle('no-bg', !hasMedia);
    if (bg.type === 'video' && url) {
        i.hidden = true; v.hidden = false; i.style.backgroundImage = '';
        document.documentElement.style.removeProperty('--bg-img');
        document.documentElement.classList.remove('img-bg');
        v.style.opacity = op;
        v.onerror = () => {
            bgVideoActive = false; bgVideoUrl = '';
            releaseVideo(v); v.hidden = true; root.classList.add('no-bg');
        };
        bgVideoActive = true;
        bgVideoUrl = url;
    } else if (bg.type === 'image' && url) {
        bgVideoActive = false; bgVideoUrl = '';
        releaseVideo(v);
        v.hidden = true; i.hidden = false;
        const safeUrl = `url("${String(url).replace(/[\\"\n\r]/g, '\\$&')}")`;
        i.style.backgroundImage = safeUrl; i.style.opacity = op;
        document.documentElement.style.setProperty('--bg-img', safeUrl);
        document.documentElement.classList.add('img-bg');
    } else {
        bgVideoActive = false; bgVideoUrl = '';
        releaseVideo(v);
        v.hidden = true;
        i.hidden = true; i.style.backgroundImage = '';
        document.documentElement.style.removeProperty('--bg-img');
        document.documentElement.classList.remove('img-bg');
    }
    syncVideoPlayback();
}

let videoVisibilityBound = false;

function setupVideoVisibility() {
    if (videoVisibilityBound) return;
    videoVisibilityBound = true;

    const sync = () => {
        if (!isPageActive()) flushPendingSaves();
        syncVideoPlayback();
        syncClockTimers();
    };

    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => { pageGone = true; sync(); });
    window.addEventListener('pageshow', () => { pageGone = false; sync(); });
    document.addEventListener('freeze', () => { pageGone = true; sync(); });
    document.addEventListener('resume', () => { pageGone = false; sync(); });

    sync();
}

function getSmartGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Доброе утро';
    if (h >= 12 && h < 18) return 'Добрый день';
    if (h >= 18 && h < 23) return 'Добрый вечер';
    return 'Доброй ночи';
}

function paintTitleAndSubtitle(s) {
    const raw = (s.title || 'KOCH BRAUZER').trim() || 'KOCH BRAUZER';
    const t = document.getElementById('main-title');
    if (t && t.textContent !== raw) t.textContent = raw;
    if (document.title !== raw) document.title = raw;
    const fb = document.getElementById('avatar-fallback');
    if (fb && !fb.hidden) {
        const ch = (raw[0] || 'K').toUpperCase();
        if (fb.textContent !== ch) fb.textContent = ch;
    }
    const sub = document.getElementById('subtitle');
    if (sub) {
        const baseSub = (s.subtitle ?? '').trim();
        const nextSub = s.smartGreeting ? (baseSub ? `${getSmartGreeting()} • ${baseSub}` : getSmartGreeting()) : baseSub;
        if (sub.textContent !== nextSub) sub.textContent = nextSub;
    }
}

function applyLayoutPreferences(s) {
    const addCatBtn = document.getElementById('add-cat');
    if (addCatBtn) addCatBtn.hidden = !!s.hideAddCat;
    const clocksSec = document.querySelector('.clocks');
    if (clocksSec) clocksSec.hidden = !!s.hideClocks;
    const avatarEl = document.getElementById('avatar');
    if (avatarEl) avatarEl.hidden = !!s.hideAvatar;
    const titleEl = document.getElementById('main-title');
    const subEl = document.getElementById('subtitle');
    if (titleEl) titleEl.hidden = !!s.hideHeroText;
    if (subEl) subEl.hidden = !!s.hideHeroText;
    const heroEl = document.querySelector('.hero');
    if (heroEl) heroEl.hidden = !!(s.hideAvatar && s.hideHeroText);
    const catsWrap = document.getElementById('cats');
    if (catsWrap) {
        if (s.catColumns && s.catColumns !== 'auto') catsWrap.dataset.cols = s.catColumns;
        else delete catsWrap.dataset.cols;
    }
    document.body.classList.toggle('chips-compact', s.chipStyle === 'compact');
    document.body.classList.toggle('chips-icon-only', !!s.hideChipNames);
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
let clockGen = 0, clocksReady = false, lastWxAt = 0, clockConfigSig = '';
let clockOpts = { hour12: false, seconds: true, date: false, hideClocks: false, wxUnit: 'C', wxDetails: false };
const WX_INTERVAL = 30 * 60 * 1000;

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

const WX_FRESH = 15 * 60 * 1000, WX_STALE = 6 * 60 * 60 * 1000;
const wxStore = (() => {
    let d = null;
    const load = () => {
        if (d) return d;
        try {
            const p = JSON.parse(safeLS.get('koch_wx'));
            d = (p && typeof p === 'object' && p.geo && typeof p.geo === 'object' && p.wx && typeof p.wx === 'object')
                ? p
                : { geo: {}, wx: {} };
        } catch {
            d = { geo: {}, wx: {} };
        }
        return d;
    };
    const save = () => { try { safeLS.set('koch_wx', JSON.stringify(d)); } catch {} };
    return {
        geo: c => load().geo[c] || null,
        wx: k => load().wx[k] || null,
        setGeo(c, v) {
            const g = load().geo;
            const keys = Object.keys(g);
            if (keys.length >= 40) delete g[keys[0]];
            g[c] = v; save();
        },
        setWx(k, v) {
            const w = load().wx;
            const keys = Object.keys(w);
            if (keys.length >= 40) delete w[keys[0]];
            w[k] = v; save();
        },
        clear() {
            d = null;
            safeLS.del('koch_wx');
        }
    };
})();

let wxRetryN = 0, wxRetryT = 0, wxNeedRetry = false;
function scheduleWxRetry() {
    clearTimeout(wxRetryT);
    if (wxRetryN >= 20) return;
    wxRetryT = setTimeout(() => { if (isPageActive()) refreshWeather(); }, Math.min(3000 * 2 ** Math.min(wxRetryN++, 5), 60000));
}

function formatTemp(celsius, unit = clockOpts.wxUnit) {
    const val = unit === 'F' ? Math.round(celsius * 9 / 5 + 32) : Math.round(celsius);
    return `${val > 0 ? '+' : ''}${val}°${unit}`;
}

function wxDesc(code) {
    if (code === 0) return 'Ясно';
    if (code === 1) return 'Преимущественно ясно';
    if (code === 2) return 'Переменная облачность';
    if (code === 3) return 'Пасмурно';
    if (code <= 48) return 'Туман';
    if (code <= 57) return 'Морось';
    if (code <= 67) return 'Дождь';
    if (code <= 77) return 'Снег';
    if (code <= 82) return 'Ливень';
    if (code <= 86) return 'Снегопад';
    return 'Гроза';
}

function wxEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌦️';
    if (code <= 67 || (code > 77 && code <= 82)) return '🌧️';
    if (code <= 86) return '❄️';
    return '⛈️';
}

function applyWxNode(elNode, w, statusHint = '') {
    if (!elNode) return;
    const wasPlaceholder = elNode.textContent === '—';
    if (!w) {
        elNode.textContent = '—';
        if (statusHint) elNode.title = statusHint;
        else elNode.removeAttribute('title');
        return;
    }
    const mainTxt = `${formatTemp(w.t)} ${wxEmoji(w.code)}`;
    if (clockOpts.wxDetails && (w.feels != null || w.wind != null)) {
        const parts = [];
        if (w.feels != null) parts.push(`ощущ. ${formatTemp(w.feels)}`);
        if (w.wind != null) parts.push(`${Math.round(w.wind)} м/с`);
        elNode.replaceChildren(
            el('span', {}, mainTxt),
            parts.length ? el('span', { class: 'wx-extra' }, parts.join(' • ')) : null
        );
    } else if (elNode.textContent !== mainTxt || elNode.children.length > 0) {
        elNode.textContent = mainTxt;
    }
    if (wasPlaceholder && !document.documentElement.classList.contains('intro')) {
        const dur = animDur(200);
        if (dur) elNode.animate?.([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: EASE });
    }
    const timeStr = w.at ? new Date(w.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    const extraTip = [];
    if (w.feels != null) extraTip.push(`ощущается как ${formatTemp(w.feels)}`);
    if (w.wind != null) extraTip.push(`ветер ${w.wind} м/с`);
    elNode.title = [wxDesc(w.code), ...extraTip, timeStr ? 'обновлено в ' + timeStr : '', 'клик — обновить'].filter(Boolean).join(' • ');
}

const geoPending = new Map();
async function geocode(city) {
    const raw = typeof city === 'string' ? city.trim() : '';
    const key = raw.toLowerCase();
    if (!key || key === '—') return { notFound: true };
    if (geoCache.has(key)) return geoCache.get(key);
    const saved = wxStore.geo(key) || wxStore.geo(city);
    if (saved && typeof saved.lat === 'number') { geoCache.set(key, saved); return saved; }
    if (geoPending.has(key)) return geoPending.get(key);
    const req = (async () => {
        try {
            const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
            const baseCity = parts[0] || raw;
            const regionHint = parts.slice(1).join(' ').toLowerCase();
            const count = regionHint ? 5 : 1;
            const d = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(baseCity)}&count=${count}&language=ru&format=json`);
            const results = d?.results || [];
            let g = results[0];
            if (regionHint && results.length > 1) {
                const matched = results.find(r => {
                    const hay = [r.country, r.country_code, r.admin1, r.admin2].filter(Boolean).join(' ').toLowerCase();
                    return hay.includes(regionHint);
                });
                if (matched) g = matched;
            }
            if (!g) {
                const nf = { notFound: true };
                geoCache.set(key, nf);
                return nf;
            }
            const info = { lat: g.latitude, lon: g.longitude, tz: g.timezone || null };
            geoCache.set(key, info);
            wxStore.setGeo(key, info);
            return info;
        } catch {
            return null;
        } finally { geoPending.delete(key); }
    })();
    geoPending.set(key, req);
    return req;
}

async function weather(lat, lon, force = false) {
    const key = lat + ',' + lon, c = wxStore.wx(key);
    if (!force && c && Date.now() - c.at < WX_FRESH && c.feels !== undefined) return c;
    const d = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=auto`);
    if (d?.current?.temperature_2m == null) throw new Error('Weather data unavailable');
    const w = {
        t: Math.round(d.current.temperature_2m),
        feels: d.current.apparent_temperature != null ? Math.round(d.current.apparent_temperature) : null,
        wind: d.current.wind_speed_10m != null ? Math.round(d.current.wind_speed_10m * 10) / 10 : null,
        code: d.current.weather_code ?? 0,
        at: Date.now()
    };
    wxStore.setWx(key, w);
    return w;
}

const FMT_SEC = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
const FMT_MIN = { hour: '2-digit', minute: '2-digit' };
let lastGreetHour = -1;
let lastCitiesSig = '';

function tick() {
    const now = new Date();
    const curMin = Math.floor(now.getTime() / 60000);
    if (settingsCache?.smartGreeting) {
        const h = now.getHours();
        if (h !== lastGreetHour) {
            lastGreetHour = h;
            paintTitleAndSubtitle(settingsCache);
        }
    }
    if (clockOpts.hideClocks) return;
    const fmtBase = clockOpts.seconds ? FMT_SEC : FMT_MIN;
    const fmtOpts = clockOpts.hour12 ? { ...fmtBase, hour: 'numeric', hour12: true } : { ...fmtBase, hour12: false };
    const locale = clockOpts.hour12 ? 'en-US' : 'ru-RU';
    for (let i = 0; i < clockSlots.length; i++) {
        const s = clockSlots[i];
        if (s.hidden) continue;
        const elT = s.el || (s.el = $(i === 0 ? '#time-a' : '#time-b'));
        if (!elT) continue;
        let text;
        try {
            if (!s.fmt) {
                try {
                    s.fmt = new Intl.DateTimeFormat(locale, { ...fmtOpts, timeZone: s.tz || undefined });
                } catch {
                    s.tz = null;
                    s.fmt = new Intl.DateTimeFormat(locale, fmtOpts);
                }
            }
            text = s.fmt.format(now);
        } catch {
            s.fmt = null;
            text = now.toLocaleTimeString(locale, fmtOpts);
        }
        if (elT.textContent !== text) elT.textContent = text;

        const elD = s.dateEl || (s.dateEl = $(i === 0 ? '#date-a' : '#date-b'));
        if (elD) {
            elD.hidden = !clockOpts.date;
            if (clockOpts.date && s.lastDateMin !== curMin) {
                s.lastDateMin = curMin;
                try {
                    if (!s.dateFmt) {
                        s.dateFmt = new Intl.DateTimeFormat('ru-RU', {
                            weekday: 'short', day: 'numeric', month: 'long', timeZone: s.tz || undefined
                        });
                    }
                    const dTxt = s.dateFmt.format(now);
                    if (elD.textContent !== dTxt) elD.textContent = dTxt;
                } catch {
                    elD.hidden = true;
                }
            }
        }
    }
}

async function refreshWeather(force = false) {
    if (clockOpts.hideClocks) return false;
    const slots = clockSlots, gen = clockGen;
    const pending = new Map();
    let failed = false, tzChanged = false;
    await Promise.all(slots.map(async (s, i) => {
        if (s.hidden) return;
        const wxEl = s.wxEl || (s.wxEl = $(i === 0 ? '#wx-a' : '#wx-b'));
        if (!wxEl) return;
        if ((!s.geo || (force && s.geo.notFound)) && s.city && s.city !== '—') {
            if (force) geoCache.delete(s.city.toLowerCase());
            s.geo = await geocode(s.city);
            if (s.geo && !s.geo.notFound) {
                const nextTz = s.geo.tz || null;
                if (nextTz !== s.tz) { s.tz = nextTz; s.fmt = null; s.dateFmt = null; s.lastDateMin = -1; tzChanged = true; }
            }
        }
        if (gen !== clockGen) return;
        const named = s.city && s.city !== '—';
        if (!s.geo || s.geo.notFound) {
            applyWxNode(wxEl, null, s.geo?.notFound && named ? 'Город не найден' : '');
            if (named && !s.geo) failed = true;
            return;
        }
        const key = s.geo.lat + ',' + s.geo.lon;
        const cached = wxStore.wx(key);
        if (!force && cached && Date.now() - cached.at < WX_STALE && gen === clockGen) applyWxNode(wxEl, cached);
        try {
            if (!pending.has(key)) pending.set(key, weather(s.geo.lat, s.geo.lon, force));
            const w = await pending.get(key);
            if (gen === clockGen) applyWxNode(wxEl, w);
        } catch {
            failed = true;
            const c = wxStore.wx(key);
            if (gen === clockGen) applyWxNode(wxEl, c && Date.now() - c.at < WX_STALE ? c : null, 'Ошибка сети');
        }
    }));
    if (gen !== clockGen) return false;
    if (tzChanged) tick();
    wxNeedRetry = failed;
    if (failed) scheduleWxRetry();
    else { wxRetryN = 0; lastWxAt = Date.now(); }
    return !failed;
}
window.addEventListener('online', () => { wxRetryN = 0; if (clocksReady && isPageActive()) refreshWeather(); });

function scheduleNextTick() {
    if (tickTimer) clearTimeout(tickTimer);
    if (!isPageActive() || !clockSlots.length || ( clockOpts.hideClocks && !settingsCache?.smartGreeting )) { tickTimer = null; return; }
    const period = (!clockOpts.hideClocks && clockOpts.seconds) ? 1000 : 60000;
    const delay = (period + 15) - (Date.now() % period);
    tickTimer = setTimeout(() => {
        tick();
        scheduleNextTick();
    }, delay);
}

function stopClockTimers() {
    if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
    if (wxTimer) { clearInterval(wxTimer); wxTimer = null; }
    if (wxRetryT) { clearTimeout(wxRetryT); wxRetryT = null; }
}

function startClockTimers() {
    stopClockTimers();
    if (!isPageActive() || !clockSlots.length) return;
    tick();
    scheduleNextTick();
    if (clocksReady && !clockOpts.hideClocks) {
        wxTimer = setInterval(refreshWeather, WX_INTERVAL);
        if (wxNeedRetry || Date.now() - lastWxAt >= WX_INTERVAL) { wxRetryN = 0; refreshWeather(); }
    }
}

function syncClockTimers() {
    if (!isPageActive()) { if (tickTimer || wxTimer) stopClockTimers(); }
    else if (!tickTimer) startClockTimers();
}

let wxClickBound = false;
function bindWxRefreshClick() {
    if (wxClickBound) return;
    wxClickBound = true;
    document.querySelector('.clocks')?.addEventListener('click', async e => {
        const wxNode = e.target.closest('.clock-wx');
        if (!wxNode) return;
        const dur = animDur(200);
        if (dur) wxNode.animate?.([{ transform: 'scale(.95)' }, { transform: 'none' }], { duration: dur, easing: EASE });
        const ok = await refreshWeather(true);
        toast(ok ? 'Погода обновлена' : 'Не удалось обновить погоду', ok ? 'info' : 'error');
    });
}

async function initClocks(preloaded) {
    bindWxRefreshClick();
    const s = preloaded || await store.getSettings();
    const cities = s.cities || ['—', '—'];
    const nextOpts = {
        hour12: s.clockFormat === '12h',
        seconds: s.clockSeconds !== false,
        date: !!s.clockDate,
        hideClocks: !!s.hideClocks,
        wxUnit: s.wxUnit === 'F' ? 'F' : 'C',
        wxDetails: !!s.wxDetails
    };
    const nextCitiesSig = JSON.stringify(cities);
    clockConfigSig = JSON.stringify({ cities: s.cities || [], ...nextOpts });

    if (clockSlots.length && nextCitiesSig === lastCitiesSig) {
        const wasHidden = clockOpts.hideClocks;
        clockOpts = nextOpts;
        for (const sl of clockSlots) {
            sl.fmt = null;
            sl.dateFmt = null;
            sl.lastDateMin = -1;
            if (!sl.hidden && sl.wxEl && sl.geo && !sl.geo.notFound) {
                const cw = wxStore.wx(sl.geo.lat + ',' + sl.geo.lon);
                applyWxNode(sl.wxEl, cw && Date.now() - cw.at < WX_STALE ? cw : null);
            }
        }
        if (nextOpts.hideClocks) {
            stopClockTimers();
            if (isPageActive() && s.smartGreeting) scheduleNextTick();
        } else if (wasHidden && isPageActive()) {
            startClockTimers();
            refreshWeather();
        } else {
            tick();
            if (isPageActive()) scheduleNextTick();
        }
        return;
    }

    stopClockTimers();
    const gen = ++clockGen;
    clocksReady = false;
    clockOpts = nextOpts;
    lastCitiesSig = nextCitiesSig;

    const cityBEmpty = !(cities[1] || '').trim();
    const cardB = $('#clock-card-b');
    if (cardB) cardB.hidden = cityBEmpty;

    clockSlots = [0, 1].map(i => {
        const rawCity = (cities[i] || '').trim();
        const hidden = i === 1 && cityBEmpty;
        const city = rawCity || '—';
        const displayCity = rawCity.includes(',') ? (rawCity.split(',')[0].trim() || city) : city;
        const nameEl = $(i === 0 ? '#city-a' : '#city-b');
        const wxEl = $(i === 0 ? '#wx-a' : '#wx-b');
        const dateEl = $(i === 0 ? '#date-a' : '#date-b');
        if (nameEl) {
            nameEl.textContent = String(displayCity).toUpperCase();
            if (rawCity.includes(',')) nameEl.title = rawCity;
            else nameEl.removeAttribute('title');
        }
        const key = rawCity.toLowerCase();
        const savedGeo = key ? (geoCache.get(key) || wxStore.geo(key) || wxStore.geo(rawCity)) : null;
        if (wxEl && !hidden) {
            const cw = (savedGeo && !savedGeo.notFound) ? wxStore.wx(savedGeo.lat + ',' + savedGeo.lon) : null;
            applyWxNode(wxEl, cw && Date.now() - cw.at < WX_STALE ? cw : null);
        }
        return {
            city,
            hidden,
            tz: savedGeo?.tz || null,
            geo: savedGeo || null,
            fmt: null,
            dateFmt: null,
            lastDateMin: -1,
            el: $(i === 0 ? '#time-a' : '#time-b'),
            dateEl,
            wxEl
        };
    });
    tick();
    if (isPageActive()) scheduleNextTick();
    clocksReady = true;
    lastWxAt = 0;
    if (isPageActive() && !nextOpts.hideClocks) {
        refreshWeather();
        wxTimer = setInterval(refreshWeather, WX_INTERVAL);
    }
}

/* ---------- 9. Поиск ---------- */
const ENGINES = {
    google: { label: 'G', name: 'Google', url: 'https://www.google.com/search?q=' },
    ddg: { label: 'DD', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    bing: { label: 'B', name: 'Bing', url: 'https://www.bing.com/search?q=' },
    yandex: { label: 'Я', name: 'Яндекс', url: 'https://yandex.ru/search/?text=' },
    brave: { label: 'BS', name: 'Brave Search', url: 'https://search.brave.com/search?q=' }
};

const SEARCH_BANGS = {
    '!g': { name: 'Google', url: 'https://www.google.com/search?q=' },
    '!y': { name: 'Яндекс', url: 'https://yandex.ru/search/?text=' },
    '!ya': { name: 'Яндекс', url: 'https://yandex.ru/search/?text=', alias: true },
    '!ddg': { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    '!b': { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    '!br': { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
    '!yt': { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=' },
    '!gh': { name: 'GitHub', url: 'https://github.com/search?q=' },
    '!w': { name: 'Wikipedia', url: 'https://ru.wikipedia.org/w/index.php?search=' },
    '!tr': { name: 'Google Переводчик', url: 'https://translate.google.com/?sl=auto&tl=ru&text=' },
    '!maps': { name: 'Google Карты', url: 'https://www.google.com/maps/search/' },
    '!ymaps': { name: 'Яндекс Карты', url: 'https://yandex.ru/maps/?text=' },
    '!oz': { name: 'Ozon', url: 'https://www.ozon.ru/search/?text=' },
    '!wb': { name: 'Wildberries', url: 'https://www.wildberries.ru/catalog/0/search.aspx?search=' },
    '!st': { name: 'Steam', url: 'https://store.steampowered.com/search/?term=' },
    '!tw': { name: 'Twitch', url: 'https://www.twitch.tv/search?term=' },
    '!rd': { name: 'Reddit', url: 'https://www.reddit.com/search/?q=' }
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
const ICO_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
let sugSel = -1;

function parseBangQuery(raw) {
    const m = raw.trim().match(/^(!\S+)(?:\s+(.*))?$/);
    if (!m) return null;
    const bang = m[1].toLowerCase();
    const spec = SEARCH_BANGS[bang];
    if (!spec) return null;
    return { bang, name: spec.name, url: spec.url, query: (m[2] || '').trim() };
}

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

const svgProto = new Map();
function svgEl(markup, cls, title) {
    const s = el('span', { class: cls, title });
    let proto = svgProto.get(markup);
    if (proto === undefined) {
        const doc = new DOMParser().parseFromString(markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'), 'image/svg+xml');
        proto = doc.documentElement && doc.documentElement.localName === 'svg' ? document.importNode(doc.documentElement, true) : null;
        svgProto.set(markup, proto);
    }
    if (proto) s.appendChild(proto.cloneNode(true));
    return s;
}

function markMatch(text, q) {
    const i = q ? text.toLowerCase().indexOf(q) : -1;
    if (i < 0) return text;
    return [text.slice(0, i), el('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length)];
}

function syncSearchClearBtn() {
    const inp = searchInput(), clr = $('#search-clear'), kbd = $('.search-kbd');
    const hasVal = !!(inp && inp.value.length);
    if (clr) clr.hidden = !hasVal;
    if (kbd) kbd.hidden = hasVal;
}

function renderSuggest() {
    const box = suggestBox(), ul = suggestList(), inp = searchInput();
    if (!box || !ul || !inp) return;
    syncSearchClearBtn();
    const raw = inp.value.trim(), q = raw.toLowerCase();
    const s = settingsCache || DEFAULT_SETTINGS;
    sugSel = -1;
    const rows = [];

    // Поиск по собственным ярлыкам
    if (q && !raw.startsWith('!') && s.searchShortcuts !== false && Array.isArray(categories)) {
        const matchedSc = [];
        for (const cat of categories) {
            for (const sc of cat.shortcuts || []) {
                const t = (sc.title || '').toLowerCase(), u = (sc.url || '').toLowerCase();
                if (t.includes(q) || u.includes(q)) {
                    matchedSc.push({ sc, catId: cat.id, catName: cat.name });
                    if (matchedSc.length >= 4) break;
                }
            }
            if (matchedSc.length >= 4) break;
        }
        matchedSc.forEach(({ sc, catId, catName }, idx) => {
            const fav = isIconUrl(sc.icon) ? sc.icon : faviconOf(sc.url);
            const icoWrap = fav
                ? el('span', { class: 'ico' }, el('img', { src: fav, alt: '', onerror: e => onFavError(e, sc.url, () => document.createTextNode('🌐')) }))
                : svgEl(ICO_LINK, 'ico');
            rows.push(el('li', {
                id: 'sg-opt-sc-' + idx,
                class: 'sc-hit',
                role: 'option',
                'aria-selected': 'false',
                title: 'ЛКМ — открыть • ПКМ — изменить ярлык',
                dataset: { url: sc.url, catId, scId: sc.id }
            },
            icoWrap,
            el('span', { class: 'q' }, markMatch(sc.title || sc.url, q)),
            el('span', { class: 'sg-tag' }, catName || 'Ярлык')));
        });
    }

    const bangInfo = raw ? parseBangQuery(raw) : null;
    const isBangPrefix = raw.startsWith('!') && !raw.includes(' ');
    let matchedBangs = [];
    if (isBangPrefix) {
        matchedBangs = Object.entries(SEARCH_BANGS)
            .filter(([k, v]) => (!v.alias || q === k) && k.startsWith(q))
            .slice(0, 7);
        matchedBangs.forEach(([k, v], idx) => {
            rows.push(el('li', {
                id: 'sg-opt-bang-' + idx,
                class: 'go',
                role: 'option',
                'aria-selected': 'false',
                dataset: { bang: k }
            },
            svgEl(ICO_SEARCH, 'ico'),
            el('span', { class: 'q' }, el('mark', {}, k), ` — искать в ${v.name}`),
            el('span', { class: 'sg-tag' }, v.name)));
        });
    }

    const directUrl = (raw && !bangInfo && !isBangPrefix) ? normalizeUrl(raw) : '';
    const isDirectUrl = !!(directUrl && (/^https?:\/\//i.test(raw) || !raw.includes(' ')));
    const items = qHistory.filter(h => !q || h.q.toLowerCase().includes(q)).slice(0, 8);
    if (raw && (!isBangPrefix || matchedBangs.length === 0) && !items.some(h => h.q.toLowerCase() === q)) {
        const labelText = bangInfo
            ? (bangInfo.query ? `Искать «${bangInfo.query}» в ${bangInfo.name}` : `Введите запрос после ${bangInfo.bang} для поиска в ${bangInfo.name}`)
            : (isDirectUrl ? `Перейти на ${raw}` : `Искать «${raw}»`);
        rows.push(el('li', {
            id: 'sg-opt-go',
            class: 'go',
            role: 'option',
            'aria-selected': 'false',
            dataset: (bangInfo && !bangInfo.query) ? { bang: bangInfo.bang } : {}
        },
        svgEl(isDirectUrl ? ICO_LINK : ICO_SEARCH, 'ico'),
        el('span', { class: 'q' }, labelText),
        bangInfo ? el('span', { class: 'sg-tag' }, bangInfo.name) : (isDirectUrl ? el('span', { class: 'sg-tag' }, 'Сайт') : null)));
    }

    items.forEach((h, idx) => {
        const ago = agoLabel(h.id);
        const fill = svgEl(ICO_FILL, 'fill', 'Вставить в поле');
        const del = svgEl(ICO_X, 'del', 'Удалить');
        rows.push(el('li', {
            id: 'sg-opt-' + idx,
            role: 'option',
            'aria-selected': 'false',
            dataset: { hid: h.id, hq: h.q }
        },
        svgEl(ICO_CLOCK, 'ico'),
        el('span', { class: 'q' }, markMatch(h.q, q)),
        ago ? el('span', { class: 'ago' }, ago) : null,
        el('span', { class: 'act' }, fill, del)));
    });

    const sgHead = $('.sg-head', box);
    if (sgHead) sgHead.hidden = items.length === 0;
    const clrBtn = $('#clear-history');
    if (clrBtn) clrBtn.hidden = items.length === 0;

    ul.replaceChildren(...rows);
    const open = rows.length > 0;
    if (open) {
        if (box._closeT) { clearTimeout(box._closeT); box._closeT = 0; }
        box.classList.remove('closing');
        box.hidden = false;
        inp.setAttribute('aria-expanded', 'true');
        inp.removeAttribute('aria-activedescendant');
    } else {
        hideSuggest();
    }
}

function moveSuggest(dir) {
    const box = suggestBox(); if (!box || box.hidden || box.classList.contains('closing')) return false;
    const lis = [...suggestList().children]; if (!lis.length) return false;
    sugSel = (sugSel + dir + lis.length) % lis.length;
    lis.forEach((li, i) => {
        const sel = i === sugSel;
        li.classList.toggle('sel', sel);
        li.setAttribute('aria-selected', String(sel));
    });
    const active = lis[sugSel];
    active.scrollIntoView({ block: 'nearest' });
    if (active.id) searchInput()?.setAttribute('aria-activedescendant', active.id);
    return true;
}

const debouncedSuggest = debounce(renderSuggest, 90);

function hideSuggest() {
    debouncedSuggest.cancel();
    const b = suggestBox();
    if (b && !b.hidden && !b.classList.contains('closing')) {
        sugSel = -1;
        const inp = searchInput();
        if (inp) {
            inp.setAttribute('aria-expanded', 'false');
            inp.removeAttribute('aria-activedescendant');
        }
        const dur = animDur(130);
        if (dur) {
            b.classList.add('closing');
            b._closeT = setTimeout(() => {
                b.classList.remove('closing');
                b.hidden = true;
                b._closeT = 0;
            }, dur);
        } else {
            b.hidden = true;
        }
    }
}

function navigateTo(targetUrl, forceNewTab = false) {
    if (!targetUrl) return;
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const openNew = forceNewTab || inIframe || !!(settingsCache && settingsCache.openInNewTab);
    if (openNew) {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        location.href = targetUrl;
    }
}

async function goSearch(forceNewTab = false) {
    const inp = searchInput(); if (!inp) return;
    const raw = inp.value.trim(); if (!raw) return;

    const bang = parseBangQuery(raw);
    if (bang && !bang.query) {
        toast(`Введите запрос после ${bang.bang}`);
        return;
    }

    const dur = animDur(180);
    if (dur) $('#search-go')?.animate?.([{ transform: 'scale(.88)' }, { transform: 'none' }], { duration: dur, easing: EASE });

    const asUrl = bang ? '' : normalizeUrl(raw);
    const isUrl = !bang && (/^https?:\/\//i.test(raw) || (asUrl !== '' && !raw.includes(' ')));
    if (!isUrl && (settingsCache || DEFAULT_SETTINGS).saveSearchHistory !== false) {
        const low = raw.toLowerCase();
        qHistory = [{ id: String(Date.now()), q: raw }, ...qHistory.filter(h => h.q.toLowerCase() !== low)].slice(0, HISTORY_LIMIT);
        await store.setHistory(qHistory);
    }
    hideSuggest();
    const targetUrl = bang
        ? bang.url + encodeURIComponent(bang.query)
        : (isUrl ? asUrl : ENGINES[engine].url + encodeURIComponent(raw));
    navigateTo(targetUrl, forceNewTab);
}

let searchBound = false;
async function initSearch(preloaded, history) {
    const s = preloaded || await store.getSettings();
    engine = ENGINES[s.engine] ? s.engine : 'google';
    qHistory = history || await store.getHistory();
    paintEngine();
    if (searchBound) return;
    searchBound = true;

    const engBtn = $('#engine-btn');
    const cycleEngine = dir => {
        const keys = Object.keys(ENGINES);
        engine = keys[(keys.indexOf(engine) + dir + keys.length) % keys.length];
        store.updateSettings(st => ({ ...st, engine }));
        paintEngine();
        const dur = animDur(180);
        if (dur && engBtn) {
            engBtn.getAnimations?.().forEach(a => a.cancel());
            engBtn.animate?.([{ transform: `scale(.78) rotate(${dir * -14}deg)` }, { transform: 'none' }], { duration: dur, easing: EASE });
        }
    };
    engBtn?.addEventListener('click', e => cycleEngine(e.shiftKey ? -1 : 1));
    engBtn?.addEventListener('contextmenu', e => { e.preventDefault(); cycleEngine(-1); });
    engBtn?.addEventListener('wheel', e => {
        if (!e.deltaY) return;
        e.preventDefault();
        cycleEngine(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    searchInput()?.addEventListener('input', () => {
        syncSearchClearBtn();
        debouncedSuggest();
    });
    searchInput()?.addEventListener('focus', renderSuggest);
    $('#search-clear')?.addEventListener('click', () => {
        const inp = searchInput();
        if (!inp) return;
        inp.value = '';
        syncSearchClearBtn();
        inp.focus();
        renderSuggest();
    });

    searchInput()?.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (moveSuggest(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
            return;
        }
        if (e.key === 'Enter' && !e.isComposing) {
            const newTab = e.ctrlKey || e.metaKey || e.shiftKey;
            const box = suggestBox();
            const li = sugSel >= 0 && box && !box.hidden && !box.classList.contains('closing') ? suggestList().children[sugSel] : null;
            if (li) {
                if (li.dataset.url) {
                    e.preventDefault();
                    hideSuggest();
                    navigateTo(normalizeUrl(li.dataset.url), newTab);
                    return;
                }
                if (li.dataset.bang) {
                    e.preventDefault();
                    e.target.value = li.dataset.bang + ' ';
                    syncSearchClearBtn();
                    renderSuggest();
                    return;
                }
                if (li.dataset.hq) e.target.value = li.dataset.hq;
                goSearch(newTab);
                return;
            }
            goSearch(newTab);
        }
        if (e.key === 'Tab') {
            const box = suggestBox();
            if (box && !box.hidden && !box.classList.contains('closing')) {
                const candidate = sugSel >= 0 ? suggestList().children[sugSel] : suggestList().children[0];
                if (candidate && candidate.dataset.bang) {
                    e.preventDefault();
                    e.target.value = candidate.dataset.bang + ' ';
                    syncSearchClearBtn();
                    renderSuggest();
                    return;
                }
            }
            hideSuggest();
            return;
        }
        if (e.key === 'Escape') {
            const box = suggestBox();
            if (box && !box.hidden && !box.classList.contains('closing')) {
                hideSuggest();
            } else if (e.target.value) {
                e.target.value = '';
                syncSearchClearBtn();
            }
        }
    });

    apiStorage.onChanged((changes, area) => {
        if (area === 'local' && changes.history) {
            const next = normalizeHistory(changes.history.newValue);
            const sig = JSON.stringify(next);
            if (sig === store.histSig) return;
            store.histSig = sig;
            qHistory = next;
            const box = suggestBox();
            if (box && !box.hidden && !box.classList.contains('closing')) renderSuggest();
        }
    });

    const sl = suggestList();
    suggestBox()?.addEventListener('mousedown', e => {
        if (e.target.closest('li, button')) e.preventDefault();
    });
    if (sl && !sl._kbDelegated) {
        sl._kbDelegated = true;
        const onSuggestActivate = (e, forceNew) => {
            const li = e.target.closest('li');
            if (!li) return;
            if (e.target.closest('.fill')) {
                if (forceNew) return;
                e.stopPropagation();
                const inp = searchInput();
                if (inp && li.dataset.hq) { inp.value = li.dataset.hq; inp.focus(); renderSuggest(); }
                return;
            }
            if (e.target.closest('.del')) {
                if (forceNew) return;
                e.stopPropagation();
                if (li.dataset.hid) {
                    qHistory = qHistory.filter(x => x.id !== li.dataset.hid);
                    store.setHistory(qHistory);
                    renderSuggest();
                }
                return;
            }
            const newTab = forceNew || e.ctrlKey || e.metaKey || e.shiftKey;
            if (li.dataset.url) {
                hideSuggest();
                navigateTo(normalizeUrl(li.dataset.url), newTab);
                return;
            }
            if (li.dataset.bang) {
                const inp = searchInput();
                if (inp) {
                    inp.value = li.dataset.bang + ' ';
                    syncSearchClearBtn();
                    inp.focus();
                    renderSuggest();
                }
                return;
            }
            if (li.dataset.hq) {
                const inp = searchInput();
                if (inp) inp.value = li.dataset.hq;
            }
            goSearch(newTab);
        };
        sl.addEventListener('click', e => onSuggestActivate(e, false));
        sl.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); onSuggestActivate(e, true); } });
        sl.addEventListener('contextmenu', e => {
            const li = e.target.closest('li.sc-hit');
            if (li && li.dataset.catId && li.dataset.scId) {
                e.preventDefault();
                hideSuggest();
                openScModal(li.dataset.catId, li.dataset.scId);
            }
        });
    }
    $('#search-go')?.addEventListener('click', e => goSearch(e.ctrlKey || e.metaKey || e.shiftKey));
    $('#search-go')?.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); goSearch(true); } });
    $('#clear-history')?.addEventListener('click', async () => {
        qHistory = [];
        await store.setHistory([]);
        renderSuggest();
    });
    document.addEventListener('click', e => { if (!e.target.closest('.search-row')) hideSuggest(); });
}

/* ---------- 10. Категории и ярлыки ---------- */
let categories = [];
let scModal = { catId: null, scId: null };

let catsBusy = false, catsDirty = false, catsPending = null, catsRun = Promise.resolve(), catsSig = '';
function renderCats(data, force = false) {
    const s = settingsCache || DEFAULT_SETTINGS;
    const renderFlags = `${!!s.numHotkeys}`;
    const sig = Array.isArray(data) ? JSON.stringify(data) + '|' + renderFlags : null;
    if (catsBusy) {
        if (force || sig === null || sig !== catsSig) {
            catsDirty = true;
            if (Array.isArray(data)) catsPending = { data, sig };
        }
        return catsRun;
    }
    if (!force && sig !== null && sig === catsSig) return catsRun;
    catsBusy = true;
    if (Array.isArray(data)) catsPending = { data, sig };
    catsRun = (async () => {
        try {
            do {
                catsDirty = false;
                const pending = catsPending;
                catsPending = null;
                categories = pending ? pending.data : await store.getCategories();
                const curS = settingsCache || DEFAULT_SETTINGS;
                const flags = `${!!curS.numHotkeys}`;
                catsSig = (pending ? pending.sig : JSON.stringify(categories) + '|' + flags);
                const wrap = $('#cats'); if (!wrap) return;
                const dur = !document.documentElement.classList.contains('intro') ? animDur(180) : 0;
                const oldCards = new Map(), oldChips = new Map();
                const prevCats = dur ? new Map() : null, prevChips = dur ? new Map() : null;
                if (wrap.childElementCount) {
                    for (const card of wrap.querySelectorAll('.cat-card[data-id]')) {
                        oldCards.set(card.dataset.id, card);
                        if (dur) prevCats.set(card.dataset.id, card.getBoundingClientRect());
                    }
                    for (const ch of wrap.querySelectorAll('.chip[data-id]')) {
                        oldChips.set(ch.dataset.id, ch);
                        if (dur) prevChips.set(ch.dataset.id, ch.getBoundingClientRect());
                    }
                    if (dur) {
                        oldCards.forEach(c => c.getAnimations?.().forEach(a => a.cancel()));
                        oldChips.forEach(c => c.getAnimations?.().forEach(a => a.cancel()));
                    }
                }
                const state = { hkCounter: 0, showHk: !!curS.numHotkeys, oldCards, oldChips };
                const nextCards = categories.map(cat => buildCard(cat, state));
                if (wrap.children.length !== nextCards.length || nextCards.some((n, i) => wrap.children[i] !== n)) {
                    wrap.replaceChildren(...nextCards);
                }
                if (prevCats) {
                    for (const card of nextCards) {
                        const prevCat = prevCats.get(card.dataset.id);
                        let cardDx = 0, cardDy = 0;
                        if (prevCat) {
                            const curCat = card.getBoundingClientRect();
                            cardDx = prevCat.left - curCat.left;
                            cardDy = prevCat.top - curCat.top;
                            if (cardDx || cardDy) {
                                card.animate?.([{ transform: `translate3d(${cardDx}px,${cardDy}px,0)` }, { transform: 'none' }], { duration: dur, easing: EASE });
                            }
                            for (const ch of card.querySelectorAll('.chip[data-id]')) {
                                const prev = prevChips.get(ch.dataset.id);
                                if (prev) {
                                    const cur = ch.getBoundingClientRect();
                                    const dx = (prev.left - cur.left) - cardDx, dy = (prev.top - cur.top) - cardDy;
                                    if (dx || dy) {
                                        ch.animate?.([{ transform: `translate3d(${dx}px,${dy}px,0)` }, { transform: 'none' }], { duration: dur, easing: EASE });
                                    }
                                } else {
                                    ch.animate?.([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: EASE });
                                }
                            }
                        } else {
                            card.animate?.([{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: EASE });
                        }
                    }
                }
            } while (catsDirty);
        } finally { catsBusy = false; }
    })();
    return catsRun;
}

function buildCardHead(cat) {
    let icoNode;
    if (cat.image) {
        icoNode = el('img', {
            class: 'cat-ico cat-ico-img', src: cat.image, alt: '', draggable: 'false',
            onerror: e => e.target.replaceWith(el('span', { class: 'cat-ico' }, cat.icon || ''))
        });
    } else {
        icoNode = el('span', { class: 'cat-ico' }, cat.icon || '');
    }
    return el('div', {
        class: 'cat-head',
        title: 'Перетащите для сортировки • ПКМ — изменить категорию'
    },
    icoNode,
    el('span', { class: 'cat-name', title: cat.name }, cat.name),
    el('button', {
        class: 'cat-add', type: 'button',
        title: 'Добавить ярлык',
        'aria-label': 'Добавить ярлык в «' + cat.name + '»'
    }, '＋'));
}

function buildCard(cat, state = { hkCounter: 0, showHk: false }) {
    const headSig = `${cat.name || ''}\0${cat.icon || ''}\0${cat.image || ''}`;
    let card = state.oldCards?.get(cat.id);
    let chips;
    if (card) {
        if (card._headSig !== headSig) {
            card._headSig = headSig;
            card.firstElementChild?.replaceWith(buildCardHead(cat));
        }
        chips = card.querySelector('.chips');
    } else {
        card = el('div', { class: 'cat-card', dataset: { id: cat.id } });
        card._headSig = headSig;
        chips = el('div', { class: 'chips' });
        card.append(buildCardHead(cat), chips);
    }
    const nextChips = (cat.shortcuts || []).map(sc => {
        const hkNum = state.showHk && state.hkCounter < 9 ? ++state.hkCounter : 0;
        const sig = `${sc.title || ''}\0${sc.url || ''}\0${sc.icon || ''}\0${hkNum}`;
        const old = state.oldChips?.get(sc.id);
        if (old && old._sig === sig) return old;
        const ch = buildChip(cat, sc, hkNum);
        ch._sig = sig;
        return ch;
    });
    if (chips.children.length !== nextChips.length || nextChips.some((n, i) => chips.children[i] !== n)) {
        chips.replaceChildren(...nextChips);
    }
    return card;
}

let dragState = null;
function clearDrag() {
    dragState = null;
    document.body.classList.remove('chip-dragging');
    document.querySelectorAll('.dragging,.drag-over,.chip-drop-before,.chip-drop-after').forEach(n =>
        n.classList.remove('dragging', 'drag-over', 'chip-drop-before', 'chip-drop-after')
    );
}

function buildChip(cat, sc, hkNum = 0) {
    const chip = el('div', {
        class: 'chip', draggable: 'true', tabindex: 0, role: 'link',
        title: sc.title || sc.url || '',
        'aria-label': sc.title || sc.url || 'Ярлык',
        dataset: { id: sc.id, url: sc.url || '' }
    });
    let ico;
    const fallbackChar = ((sc.title || '').trim()[0] || '🌐').toUpperCase();
    const makeFb = () => el('span', {}, fallbackChar);
    if (isIconUrl(sc.icon)) {
        ico = el('img', { src: sc.icon, alt: '', draggable: 'false', decoding: 'async', loading: 'lazy', onerror: e => e.target.replaceWith(makeFb()) });
    } else if (sc.icon) {
        ico = el('span', {}, sc.icon);
    } else {
        const fav = faviconOf(sc.url);
        if (fav) {
            ico = el('img', { src: fav, alt: '', draggable: 'false', decoding: 'async', loading: 'lazy', onerror: e => onFavError(e, sc.url, makeFb) });
        } else {
            ico = makeFb();
        }
    }
    chip.append(
        el('div', { class: 'chip-ico' }, ico),
        el('div', { class: 'chip-name', title: sc.title }, sc.title)
    );
    if (hkNum > 0) chip.append(el('span', { class: 'chip-hk', 'aria-hidden': 'true' }, String(hkNum)));
    return chip;
}

async function saveCats(skipRender = false) {
    await store.setCategories(categories);
    if (!skipRender) await renderCats(categories, true);
    const sg = $('#suggest');
    if (sg && !sg.hidden) renderSuggest();
}

function moveChip(from, scId, to, targetId, after) {
    const s = categories.find(c => c.id === from), d = categories.find(c => c.id === to);
    if (!s || !d || targetId === scId) return;
    const idx = s.shortcuts.findIndex(x => x.id === scId);
    if (idx === -1) return;
    if (from === to && !targetId && idx === s.shortcuts.length - 1) return;
    const [sc] = s.shortcuts.splice(idx, 1);
    let pos = d.shortcuts.length;
    const t = targetId ? d.shortcuts.findIndex(x => x.id === targetId) : -1;
    if (t !== -1) pos = t + (after ? 1 : 0);
    d.shortcuts.splice(pos, 0, sc);
    if (from === to && pos === idx) return;
    saveCats();
}

function flipReorder(wrap, mutate, skipNode) {
    const cards = [...wrap.children].filter(c => c !== skipNode);
    const first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
    mutate();
    const dur = animDur(180);
    if (!dur) return;
    for (const c of cards) {
        const a = first.get(c), b = c.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) {
            c.getAnimations?.().forEach(an => an.cancel());
            c.animate([{ transform: `translate3d(${dx}px,${dy}px,0)` }, { transform: 'none' }],
                      { duration: dur, easing: EASE });
        }
    }
}

function startCatDrag(e, card, head) {
    if (e.button !== 0 || e.target.closest('button')) return;
    const wrap = card.parentElement, sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let on = false, ph = null, origNext = null, lock = 0, rafId = 0, lastX = sx, lastY = sy, lastSwap = null;
    let ended = false;

    const step = () => {
        rafId = 0;
        if (ended || !on) return;
        const x = lastX, y = lastY;
        card.style.transform = `translate3d(${x - sx}px,${y - sy}px,0)`;
        let scrolled = false;
        if (y < 70) { window.scrollBy(0, -14); scrolled = true; }
        else if (y > innerHeight - 70) { window.scrollBy(0, 14); scrolled = true; }
        const now = performance.now();
        if (now >= lock) {
            let hit = null, overPh = false;
            for (const n of wrap.children) {
                if (n === card) continue;
                const q = n.getBoundingClientRect();
                if (x >= q.left && x <= q.right && y >= q.top && y <= q.bottom) {
                    if (n === ph) overPh = true;
                    else hit = n;
                    break;
                }
            }
            if (!hit) { if (!overPh) lastSwap = null; }
            else if (hit !== lastSwap) {
                lastSwap = hit;
                lock = now + 170;
                flipReorder(wrap, () => (ph.compareDocumentPosition(hit) & Node.DOCUMENT_POSITION_FOLLOWING) ? hit.after(ph) : hit.before(ph), card);
            }
        }
        if (scrolled && !rafId) rafId = requestAnimationFrame(step);
    };

    const move = ev => {
        if (ev.pointerId !== pid || ended) return;
        const x = ev.clientX, y = ev.clientY;
        lastX = x; lastY = y;
        if (!on) {
            if (Math.hypot(x - sx, y - sy) < 6) return;
            on = true;
            try { head.setPointerCapture(pid); } catch {}
            origNext = card.nextElementSibling;
            card.getAnimations?.().forEach(a => a.cancel());
            const r = card.getBoundingClientRect();
            ph = el('div', { class: 'cat-ph' });
            ph.style.height = r.height + 'px';
            card.before(ph);
            card.classList.add('dragging');
            Object.assign(card.style, {
                position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
                height: r.height + 'px', zIndex: 60, pointerEvents: 'none', margin: 0, willChange: 'transform'
            });
            document.body.classList.add('cat-dragging');
        }
        if (!rafId) rafId = requestAnimationFrame(step);
    };

    const onKey = ev => { if (ev.key === 'Escape') end({ pointerId: pid }, true); };
    const onBlur = () => end({ pointerId: pid }, true);
    const onScroll = () => { if (on && !ended && !rafId) rafId = requestAnimationFrame(step); };
    const end = (ev, cancel) => {
        if (ended || (ev && ev.pointerId != null && ev.pointerId !== pid)) return;
        ended = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('contextmenu', cancelUp, true);
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', cancelUp);
        head.removeEventListener('lostpointercapture', cancelUp);
        if (on) { try { head.releasePointerCapture(pid); } catch {} }
        if (!on) return;
        document.body.classList.remove('cat-dragging');
        const from = card.getBoundingClientRect();
        for (const p of ['position', 'left', 'top', 'width', 'height', 'zIndex', 'pointerEvents', 'margin', 'transform', 'willChange']) card.style[p] = '';
        card.classList.remove('dragging');
        if (cancel) {
            flipReorder(wrap, () => {
                ph.remove();
                if (origNext && origNext.parentNode === wrap) origNext.before(card);
                else wrap.append(card);
            }, card);
        } else if (ph.parentNode) {
            ph.replaceWith(card);
        }
        const to = card.getBoundingClientRect();
        const dur = animDur(160);
        if (dur && (from.left !== to.left || from.top !== to.top)) {
            card.animate([{ transform: `translate3d(${from.left - to.left}px,${from.top - to.top}px,0)` }, { transform: 'none' }],
                         { duration: dur, easing: EASE });
        }
        if (cancel) return;
        const byId = new Map(categories.map(c => [c.id, c]));
        const next = [...wrap.children].map(n => byId.get(n.dataset.id)).filter(Boolean);
        if (next.length === categories.length && next.some((c, i) => c !== categories[i])) {
            categories = next;
            const hasHk = !!settingsCache?.numHotkeys;
            if (!hasHk) catsSig = JSON.stringify(categories) + '|false';
            saveCats(!hasHk);
        }
    };
    const up = ev => end(ev, false), cancelUp = ev => end(ev, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('contextmenu', cancelUp, true);
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', cancelUp);
    head.addEventListener('lostpointercapture', cancelUp);
}

function updateIconPreview(iconValue, urlValue) {
    const preview = $('#sc-icon-preview');
    const hint = $('#sc-icon-hint');
    if (!preview) return;

    delete preview.dataset.fbTried;
    preview.onerror = () => {
        if (!iconValue && urlValue && !preview.dataset.fbTried) {
            preview.dataset.fbTried = '1';
            const alt = faviconFallbackOf(urlValue);
            if (alt && preview.src !== alt) { preview.src = alt; return; }
        }
        preview.hidden = true;
    };
    preview.onload = () => {
        const dur = animDur(180);
        if (dur) preview.animate?.([{ opacity: 0, transform: 'scale(.88)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: EASE });
    };
    if (isIconUrl(iconValue)) {
        if (preview.getAttribute('src') !== iconValue) preview.src = iconValue;
        preview.hidden = false;
        if (hint) hint.textContent = 'Своя иконка';
    } else if (iconValue) {
        preview.hidden = true;
        preview.removeAttribute('src');
        if (hint) hint.textContent = 'Эмодзи: ' + iconValue;
    } else {
        const src = urlValue ? faviconOf(urlValue) : '';
        if (src) {
            if (preview.getAttribute('src') !== src) preview.src = src;
            preview.hidden = false;
        } else {
            preview.hidden = true;
            preview.removeAttribute('src');
        }
        if (hint) hint.textContent = 'Дефолтная иконка по домену';
    }
}

function pickImage(max) {
    return new Promise(resolve => {
        const input = el('input', { type: 'file', accept: 'image/*' });
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return resolve(null);
            try { resolve(await downscaleImage(file, max)); }
            catch (err) { console.error('[KOCH] image:', err); toast('Не удалось загрузить картинку', 'error'); resolve(null); }
        };
        input.click();
    });
}

async function uploadShortcutIcon() {
    const dataUrl = await pickImage(64);
    if (!dataUrl) return;
    const iconField = $('#sc-icon');
    if (iconField) iconField.value = dataUrl;
    updateIconPreview(dataUrl, $('#sc-url')?.value || '');
    toast('Иконка загружена');
}

function resetConfirm(btn) {
    if (!btn) return;
    if (btn._confirmT) { clearTimeout(btn._confirmT); btn._confirmT = 0; }
    if (btn.dataset.origText) {
        btn.textContent = btn.dataset.origText;
        delete btn.dataset.origText;
    }
    delete btn.dataset.confirm;
}

function armConfirm(btn, confirmText = 'Точно удалить?') {
    if (!btn) return false;
    if (btn.dataset.confirm === '1') {
        resetConfirm(btn);
        return true;
    }
    btn.dataset.origText = btn.textContent;
    btn.dataset.confirm = '1';
    btn.textContent = confirmText;
    if (btn._confirmT) clearTimeout(btn._confirmT);
    btn._confirmT = setTimeout(() => resetConfirm(btn), 3200);
    return false;
}

function openScModal(catId, scId) {
    bindScModal();
    const cat = categories.find(c => c.id === catId) || (scId ? categories.find(c => c.shortcuts?.some(x => x.id === scId)) : null);
    const sc = scId ? cat?.shortcuts?.find(x => x.id === scId) : null;
    scModal = { catId: cat?.id || catId, scId: sc?.id || null };
    const catSel = $('#sc-cat');
    if (catSel) {
        catSel.replaceChildren(...categories.map(c =>
            el('option', { value: c.id }, (c.icon ? c.icon + ' ' : '') + (c.name || 'Категория'))
        ));
        catSel.value = scModal.catId || (categories[0]?.id ?? '');
    }
    const name = $('#sc-name'), url = $('#sc-url'), icon = $('#sc-icon');
    if (name) name.value = sc?.title || '';
    if (url) url.value = sc?.url || '';
    if (icon) icon.value = sc?.icon || '';
    updateIconPreview(sc?.icon || '', sc?.url || '');
    const h = $('#sc-modal-heading'); if (h) h.textContent = sc ? 'Изменить ярлык' : 'Новый ярлык';
    const d = $('#sc-delete'); if (d) d.hidden = !sc;
    toggleOverlay($('#sc-modal'), true, '#sc-name');
}

let overlayReturn = null;
function toggleOverlay(ov, open, focusSel = '.close-btn') {
    if (!ov) return;
    if (open) {
        const wasClosing = ov.classList.contains('closing');
        if (ov._closeT) { clearTimeout(ov._closeT); ov._closeT = 0; }
        const wasOpen = !ov.hidden && !wasClosing;
        ov.classList.remove('closing');
        ov.hidden = false;
        if (wasClosing) {
            const m = ov.querySelector('.modal');
            const dur = animDur(180);
            if (dur && m) m.animate?.([{ opacity: 0, transform: 'translate3d(0,8px,0) scale(.975)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: EASE });
        }
        for (const n of document.querySelectorAll('.topbar,.panel')) n.inert = true;
        if (wasOpen) return;
        if (!overlayReturn) overlayReturn = document.activeElement;
        ov.querySelector(focusSel)?.focus({ preventScroll: true });
        const body = ov.querySelector('.modal-body');
        if (body) body.scrollTop = 0;
    } else {
        if (ov.hidden || ov.classList.contains('closing')) return;
        if (ov.id === 'sc-modal') {
            scModal = { catId: null, scId: null };
            const p = $('#sc-icon-preview'); if (p) { p.hidden = true; p.removeAttribute('src'); }
        } else if (ov.id === 'cat-modal') {
            catModal = { id: null, image: '' };
            resetConfirm($('#cat-delete'));
            const p = $('#cat-img-preview'); if (p) { p.hidden = true; p.removeAttribute('src'); }
        } else if (ov.id === 'settings-overlay') {
            resetConfirm($('#reset-btn'));
        }
        const dur = animDur(160);
        if (dur) {
            ov.classList.add('closing');
            ov._closeT = setTimeout(() => {
                ov.classList.remove('closing');
                ov.hidden = true;
                ov._closeT = 0;
            }, dur);
        } else {
            ov.hidden = true;
        }
        const anyOpen = !!document.querySelector('.overlay:not([hidden]):not(.closing)');
        for (const n of document.querySelectorAll('.topbar,.panel')) n.inert = anyOpen;
        if (!anyOpen) {
            if (overlayReturn && overlayReturn.isConnected) overlayReturn.focus?.({ preventScroll: true });
            overlayReturn = null;
        }
    }
}
const closeOverlays = () => document.querySelectorAll('.overlay:not([hidden]):not(.closing)').forEach(ov => toggleOverlay(ov, false));

function closeScModal() { toggleOverlay($('#sc-modal'), false); }

let scModalBound = false;
function bindScModal() {
    if (scModalBound) return;
    scModalBound = true;
    const form = $('#sc-form'); if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const origCat = categories.find(c => c.id === scModal.catId)
            || (scModal.scId ? categories.find(c => c.shortcuts?.some(x => x.id === scModal.scId)) : null);
        const targetCatId = $('#sc-cat')?.value || scModal.catId;
        const targetCat = categories.find(c => c.id === targetCatId) || origCat;
        if (!targetCat) return;
        const normUrl = normalizeUrl($('#sc-url')?.value);
        if (!normUrl) { toast('Не похоже на адрес сайта. Пример: example.com', 'error'); return; }
        let title = ($('#sc-name')?.value || '').trim();
        if (!title) {
            try {
                const h = new URL(normUrl).hostname.replace(/^www\./i, '');
                title = (h.split('.')[0] || h);
                title = title.charAt(0).toUpperCase() + title.slice(1);
            } catch { title = normUrl; }
        }
        const rawIcon = ($('#sc-icon')?.value || '').trim();
        const icon = (!rawIcon || /^(https?:|data:)/i.test(rawIcon)) ? rawIcon : (normalizeUrl(rawIcon) || rawIcon);
        const data = {
            title,
            url: normUrl,
            icon
        };
        const isEdit = !!(scModal.scId && origCat);
        if (isEdit) {
            const idx = origCat.shortcuts.findIndex(x => x.id === scModal.scId);
            if (idx !== -1) {
                const sc = origCat.shortcuts[idx];
                Object.assign(sc, data);
                if (targetCat !== origCat) {
                    origCat.shortcuts.splice(idx, 1);
                    targetCat.shortcuts.push(sc);
                }
            }
        } else {
            targetCat.shortcuts.push({ id: uid(), ...data });
        }
        closeScModal();
        await saveCats();
        toast(isEdit ? 'Ярлык обновлён' : 'Ярлык добавлен');
    });
    $('#sc-delete')?.addEventListener('click', async () => {
        const scId = scModal.scId;
        if (!scId) return;
        const cat = categories.find(c => c.id === scModal.catId && c.shortcuts?.some(x => x.id === scId))
            || categories.find(c => c.shortcuts?.some(x => x.id === scId));
        if (!cat) return;
        cat.shortcuts = cat.shortcuts.filter(x => x.id !== scId);
        closeScModal();
        await saveCats();
        toast('Ярлык удалён');
    });

    $('#sc-icon-upload')?.addEventListener('click', uploadShortcutIcon);

    $('#sc-icon-reset')?.addEventListener('click', () => {
        const iconField = $('#sc-icon');
        if (iconField) iconField.value = '';
        updateIconPreview('', $('#sc-url')?.value || '');
        toast('Иконка сброшена на дефолтную');
    });

    const syncScPreview = debounce(() => {
        const iconVal = ($('#sc-icon')?.value || '').trim();
        updateIconPreview(iconVal, $('#sc-url')?.value || '');
    }, 200);
    $('#sc-url')?.addEventListener('input', syncScPreview);
    $('#sc-icon')?.addEventListener('input', syncScPreview);
}

const CAT_EMOJIS = ['🌐','🎵','🎮','💻','🛒','📚','🎨','📰','🏠','📱','🔧','💎','🚀','🎯','☕','📺','🌙','⭐','🎬','🧩'];
let catModal = { id: null, image: '' };
let catFormBound = false;

function renderCatImage() {
    const img = $('#cat-img-preview'), has = !!catModal.image;
    img.hidden = !has;
    if (has) {
        img.onload = () => {
            const dur = animDur(180);
            if (dur) img.animate?.([{ opacity: 0, transform: 'scale(.88)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: EASE });
        };
        if (img.getAttribute('src') !== catModal.image) img.src = catModal.image;
    } else {
        img.removeAttribute('src');
    }
    $('#cat-img-clear').hidden = !has;
    $('#cat-img-hint').textContent = has ? 'Картинка показывается вместо эмодзи' : 'Без картинки показывается эмодзи';
}

function bindCatForm() {
    if (catFormBound) return;
    catFormBound = true;
    $('#cat-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const name = $('#cat-name').value.trim();
        if (!name) return;
        const fields = { name, icon: $('#cat-icon').value.trim(), image: catModal.image };
        const cat = categories.find(c => c.id === catModal.id);
        if (cat) Object.assign(cat, fields);
        else categories.push({ id: uid(), shortcuts: [], ...fields });
        toggleOverlay($('#cat-modal'), false);
        await saveCats();
        toast(cat ? 'Категория обновлена' : 'Категория добавлена');
    });
    $('#cat-sort-az')?.addEventListener('click', async () => {
        const cat = categories.find(c => c.id === catModal.id);
        if (!cat || (cat.shortcuts?.length || 0) < 2) return;
        const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
        cat.shortcuts.sort((a, b) => collator.compare(a.title || a.url || '', b.title || b.url || ''));
        await saveCats();
        toast('Ярлыки отсортированы А–Я');
    });
    $('#cat-delete')?.addEventListener('click', async e => {
        const cat = categories.find(c => c.id === catModal.id);
        if (!cat) return;
        if ((cat.shortcuts?.length || 0) > 0 && !armConfirm(e.currentTarget, 'Точно удалить?')) return;
        categories = categories.filter(c => c !== cat);
        toggleOverlay($('#cat-modal'), false);
        await saveCats();
        toast('Категория удалена');
    });
    $('#cat-img-upload')?.addEventListener('click', async () => {
        const dataUrl = await pickImage(128);
        if (dataUrl) { catModal.image = dataUrl; renderCatImage(); }
    });
    $('#cat-img-clear')?.addEventListener('click', () => { catModal.image = ''; renderCatImage(); });
}

function openCatModal(id) {
    bindCatForm();
    const cat = categories.find(c => c.id === id);
    catModal = { id: cat ? cat.id : null, image: cat?.image || '' };
    $('#cat-modal-heading').textContent = cat ? 'Категория' : 'Новая категория';
    $('#cat-name').value = cat ? cat.name : '';
    $('#cat-icon').value = cat ? cat.icon : CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)];
    const delBtn = $('#cat-delete');
    resetConfirm(delBtn);
    if (delBtn) delBtn.hidden = !cat;
    const sortBtn = $('#cat-sort-az');
    if (sortBtn) sortBtn.hidden = (cat?.shortcuts?.length || 0) < 2;
    renderCatImage();
    toggleOverlay($('#cat-modal'), true, '#cat-name');
}

function openChipUrl(chip, forceNewTab) {
    const u = normalizeUrl(chip.dataset.url);
    if (!u) return;
    const dur = animDur(160);
    if (dur) chip.animate?.([{ transform: 'scale(.93)' }, { transform: 'none' }], { duration: dur, easing: EASE });
    navigateTo(u, forceNewTab);
}

let catModalBound = false;
function bindCatModal() {
    if (catModalBound) return;
    catModalBound = true;
    const wrap = $('#cats');
    if (wrap) {
        wrap.addEventListener('click', e => {
            const addBtn = e.target.closest('.cat-add');
            if (addBtn) {
                e.stopPropagation();
                const card = addBtn.closest('.cat-card');
                if (card) openScModal(card.dataset.id, null);
                return;
            }
            const chip = e.target.closest('.chip');
            if (chip) openChipUrl(chip, e.ctrlKey || e.metaKey || e.shiftKey);
        });
        wrap.addEventListener('auxclick', e => {
            if (e.button !== 1) return;
            const chip = e.target.closest('.chip');
            if (chip) { e.preventDefault(); openChipUrl(chip, true); }
        });
        wrap.addEventListener('keydown', e => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openChipUrl(chip, e.ctrlKey || e.metaKey || e.shiftKey);
            }
        });
        wrap.addEventListener('contextmenu', e => {
            const chip = e.target.closest('.chip');
            if (chip) {
                e.preventDefault(); e.stopPropagation();
                const card = chip.closest('.cat-card');
                if (card) openScModal(card.dataset.id, chip.dataset.id);
                return;
            }
            const head = e.target.closest('.cat-head');
            if (head) {
                e.preventDefault();
                const card = head.closest('.cat-card');
                if (card) openCatModal(card.dataset.id);
            }
        });
        wrap.addEventListener('pointerdown', e => {
            const head = e.target.closest('.cat-head');
            if (!head) return;
            const card = head.closest('.cat-card');
            if (card) startCatDrag(e, card, head);
        });
        wrap.addEventListener('dragstart', e => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            const card = chip.closest('.cat-card');
            if (!card) return;
            e.stopPropagation();
            dragState = { type: 'chip', catId: card.dataset.id, id: chip.dataset.id };
            e.dataTransfer.setData('text/plain', 'chip');
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                chip.classList.add('dragging');
                document.body.classList.add('chip-dragging');
            }, 0);
        });
        const resolveChipDrop = (card, e, dr) => {
            const sy = window.scrollY;
            if (dr.overCard !== card || dr.scrollY !== sy) {
                dr.overCard = card;
                dr.scrollY = sy;
                dr.chipRects = [...card.querySelectorAll('.chip')].map(el => ({ el, id: el.dataset.id, r: el.getBoundingClientRect() }));
            }
            const x = e.clientX, y = e.clientY;
            let hit = null;
            const direct = e.target.closest('.chip');
            if (direct && card.contains(direct)) {
                hit = dr.chipRects.find(c => c.el === direct) || null;
            } else {
                let bestD = 14;
                for (const c of dr.chipRects) {
                    if (y < c.r.top - 6 || y > c.r.bottom + 6) continue;
                    const dx = x < c.r.left ? c.r.left - x : (x > c.r.right ? x - c.r.right : 0);
                    if (dx <= bestD) { bestD = dx; hit = c; }
                }
            }
            if (!hit) return { target: null, after: false, self: false };
            if (hit.id === dr.id) return { target: null, after: false, self: true };
            return { target: hit.el, after: x > hit.r.left + hit.r.width / 2, self: false };
        };
        wrap.addEventListener('dragover', e => {
            if (!dragState || dragState.type !== 'chip') return;
            const card = e.target.closest('.cat-card');
            if (!card) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!card.classList.contains('drag-over')) {
                wrap.querySelectorAll('.cat-card.drag-over').forEach(c => { if (c !== card) c.classList.remove('drag-over'); });
                card.classList.add('drag-over');
            }
            const { target, after } = resolveChipDrop(card, e, dragState);
            if (dragState.lastTarget !== target) {
                if (dragState.lastTarget) dragState.lastTarget.classList.remove('chip-drop-before', 'chip-drop-after');
                dragState.lastTarget = target;
                dragState.lastAfter = null;
            }
            if (target && after !== dragState.lastAfter) {
                dragState.lastAfter = after;
                target.classList.toggle('chip-drop-after', after);
                target.classList.toggle('chip-drop-before', !after);
            }
        });
        wrap.addEventListener('dragleave', e => {
            if (!dragState || dragState.type !== 'chip') return;
            const card = e.target.closest('.cat-card');
            if (card && !card.contains(e.relatedTarget)) {
                card.classList.remove('drag-over');
                if (dragState.overCard === card) { dragState.overCard = null; dragState.chipRects = null; }
                if (dragState.lastTarget && card.contains(dragState.lastTarget)) {
                    dragState.lastTarget.classList.remove('chip-drop-before', 'chip-drop-after');
                    dragState.lastTarget = null;
                    dragState.lastAfter = null;
                }
            }
        });
        wrap.addEventListener('drop', e => {
            const dr = dragState;
            if (!dr || dr.type !== 'chip') return;
            const card = e.target.closest('.cat-card');
            if (!card) return;
            e.preventDefault();
            e.stopPropagation();
            const { target, after, self } = resolveChipDrop(card, e, dr);
            clearDrag();
            if (self) return;
            moveChip(dr.catId, dr.id, card.dataset.id, target && target.dataset.id, after);
        });
        wrap.addEventListener('dragend', e => {
            if (e.target.closest('.chip')) clearDrag();
        });
    }
    $('#add-cat')?.addEventListener('click', () => openCatModal(null));
}

/* ---------- 11. Настройки ---------- */
const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); return e; };
const val = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; if (e.type === 'range') paintRange(e); } };
const chk = (id, v) => { const e = document.getElementById(id); if (e) e.checked = Boolean(v); };

function paintRange(e) {
    const mn = +e.min || 0, mx = +e.max || 100;
    e.style.setProperty('--p', ((e.value - mn) / (mx - mn || 1) * 100) + '%');
}
const txt = (id, s) => { const e = document.getElementById(id); if (e) e.textContent = s; };

function downscaleImage(file, max = 256) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
                const w = Math.max(1, Math.round((img.width || max) * scale));
                const h = Math.max(1, Math.round((img.height || max) * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);
                const webp = canvas.toDataURL('image/webp', 0.9);
                const out = webp && webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
                canvas.width = canvas.height = 0;
                resolve(out);
            } catch (err) { reject(err); }
            finally { URL.revokeObjectURL(url); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode error')); };
        img.src = url;
    });
}

const resolveValue = (v, prev) => typeof v === 'function' ? v(prev) : v;

async function updateSetting(key, valueOrFn) {
    return store.updateSettings(s => ({ ...s, [key]: resolveValue(valueOrFn, s[key]) }));
}

async function updateAppearanceSetting(key, valueOrFn, applyDom = true) {
    const s = await store.updateSettings(s => ({ ...s, appearance: { ...s.appearance, [key]: resolveValue(valueOrFn, s.appearance[key]) } }));
    if (applyDom) applyAppearance(s.appearance);
}

async function setCustomColor(hex) {
    await store.updateSettings(s => ({ ...s, customColor: hex, theme: 'custom' }));
    document.documentElement.dataset.theme = 'custom';
    document.body.dataset.theme = 'custom';
    appliedTheme = 'custom';
    applyCustomThemeVars(hex);
    const sel = $('#theme-select'); if (sel) sel.value = 'custom';
    syncThemeSwatches('custom');
}

const LIVE_SLIDER_VARS = {
    panelOpacity: v => ['--panel-opacity', v / 100],
    cardOpacity: v => ['--card-opacity', v / 100],
    panelBlur: v => {
        document.documentElement.classList.toggle('no-blur', v <= 0);
        return [['--panel-blur', v + 'px'], ['--panel-bf', v > 0 ? `blur(${v}px)` : 'none']];
    },
    historyBlur: v => ['--sg-bf', v > 0 ? `blur(${v}px)` : 'none'],
    historyOpacity: v => ['--sg-op', v + '%'],
    settingsOpacity: v => ['--set-op', v + '%'],
    settingsBlur: v => ['--set-bf', v > 0 ? `blur(${v}px)` : 'none'],
    panelWidth: v => ['--panel-width', v + 'px'],
    panelPad: v => ['--panel-pad', v + 'px'],
    panelMargin: v => ['--panel-mt', v + 'px'],
    cardPad: v => ['--card-pad', v + 'px'],
    gridGap: v => ['--grid-gap', v + 'px'],
    chipGap: v => ['--chip-gap', v + 'px'],
    chipMin: v => ['--chip-min', v + 'px'],
    searchWidth: v => ['--search-width', v + '%'],
    searchHeight: v => ['--search-height', v + 'px'],
    avatarSize: v => ['--avatar-size', v + 'px'],
    iconSize: v => ['--chip-ico-size', v + 'px'],
    titleSize: v => ['--title-size', v + 'px'],
    subSize: v => ['--sub-size', v + 'px'],
    clockSize: v => ['--clock-size', v + 'px'],
    chipFont: v => ['--chip-font', v + 'px'],
    'radius.panel': v => ['--radius-panel', v + 'px'],
    'radius.card': v => ['--radius-card', v + 'px'],
    'radius.button': v => ['--radius-button', v + 'px'],
    'radius.chip': v => ['--radius-chip', v + 'px'],
    'radius.input': v => ['--radius-input', v + 'px'],
    'radius.search': v => ['--radius-search', v + 'px'],
    'radius.avatar': v => ['--radius-avatar', v + '%'],
    'font.size': v => ['--font-size', v + 'px'],
    'font.weight': v => ['--font-weight', v],
    'font.lineHeight': v => ['--line-height', v],
    'font.letterSpacing': v => ['--ls', v + 'em'],
    'font.titleSpacing': v => ['--ls-title', v + 'em'],
    'font.subtitleSpacing': v => ['--ls-sub', v + 'em'],
    transitionSpeed: v => ['--transition-speed', v + 's']
};

const fmtNum = v => typeof v === 'number' && v % 1 !== 0 ? String(Number(v.toFixed(2))) : String(v);

function bindSlider(inputId, path, suffix, step = 1) {
    const valueId = inputId + '-val';
    const parse = e => step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    let raf = 0, latest = 0;
    const applyLive = () => {
        raf = 0;
        const fn = LIVE_SLIDER_VARS[path];
        if (!fn) return;
        const res = fn(latest);
        const st = document.documentElement.style;
        if (Array.isArray(res[0])) res.forEach(([k, val]) => st.setProperty(k, val));
        else st.setProperty(res[0], res[1]);
    };
    const save = saveDebounced(v => {
        if (raf) { cancelAnimationFrame(raf); applyLive(); }
        const parts = path.split('.');
        if (parts.length === 1) updateAppearanceSetting(parts[0], v, false);
        else updateAppearanceSetting(parts[0], prev => ({ ...prev, [parts[1]]: v }), false);
    }, 120);
    on(inputId, 'input', e => {
        const v = parse(e);
        latest = v;
        txt(valueId, fmtNum(v) + suffix);
        if (!raf) raf = requestAnimationFrame(applyLive);
        save(v);
    });
}

function paintAvatar(url, title = '') {
    const img = document.getElementById('avatar-img'), fb = document.getElementById('avatar-fallback');
    if (!img || !fb) return;
    const char = ((title || document.getElementById('main-title')?.textContent || 'K').trim()[0] || 'K').toUpperCase();
    if (fb.textContent !== char) fb.textContent = char;
    img.onerror = () => { img.hidden = true; img.removeAttribute('src'); fb.hidden = false; };
    if (url) {
        if (img.getAttribute('src') !== url) img.src = url;
        img.hidden = false; fb.hidden = true;
    } else {
        img.hidden = true;
        img.removeAttribute('src');
        fb.hidden = false;
    }
}

function invalidateRuntimeState() {
    cancelPendingSaves();
    settingsCache = null;
    categories = [];
    catsSig = '';
    catsPending = null;
    qHistory = [];
    appliedTheme = null;
    bgMediaSig = '';
    bgAppliedSig = '';
    clockConfigSig = '';
    lastCitiesSig = '';
    lastGreetHour = -1;
    geoCache.clear();
    hideSuggest();
    if (bgObjectUrl) {
        try { URL.revokeObjectURL(bgObjectUrl); } catch {}
        bgObjectUrl = null;
    }
}

const SLIDERS = [
    ['set-panel-opacity', 'panelOpacity', '%'],
    ['set-card-opacity', 'cardOpacity', '%'],
    ['set-panel-blur', 'panelBlur', 'px'],
    ['set-history-blur', 'historyBlur', 'px'],
    ['set-history-opacity', 'historyOpacity', '%'],
    ['set-settings-opacity', 'settingsOpacity', '%'],
    ['set-settings-blur', 'settingsBlur', 'px'],
    ['set-panel-width', 'panelWidth', 'px', 10],
    ['set-panel-margin', 'panelMargin', 'px', 2],
    ['set-panel-pad', 'panelPad', 'px'],
    ['set-card-pad', 'cardPad', 'px'],
    ['set-grid-gap', 'gridGap', 'px'],
    ['set-chip-gap', 'chipGap', 'px'],
    ['set-chip-min', 'chipMin', 'px', 2],
    ['set-search-width', 'searchWidth', '%'],
    ['set-search-height', 'searchHeight', 'px', 2],
    ['set-avatar-size', 'avatarSize', 'px', 2],
    ['set-icon-size', 'iconSize', 'px', 2],
    ['set-title-size', 'titleSize', 'px'],
    ['set-sub-size', 'subSize', 'px'],
    ['set-clock-size', 'clockSize', 'px'],
    ['set-chip-font', 'chipFont', 'px'],
    ['set-radius-panel', 'radius.panel', 'px'],
    ['set-radius-card', 'radius.card', 'px'],
    ['set-radius-button', 'radius.button', 'px'],
    ['set-radius-chip', 'radius.chip', 'px'],
    ['set-radius-input', 'radius.input', 'px'],
    ['set-radius-search', 'radius.search', 'px'],
    ['set-radius-avatar', 'radius.avatar', '%'],
    ['set-font-size', 'font.size', 'px'],
    ['set-font-weight', 'font.weight', ''],
    ['set-line-height', 'font.lineHeight', '', 0.1],
    ['set-ls', 'font.letterSpacing', 'em', 0.01],
    ['set-ls-title', 'font.titleSpacing', 'em', 0.01],
    ['set-ls-sub', 'font.subtitleSpacing', 'em', 0.01],
    ['set-transition-speed', 'transitionSpeed', 's', 0.01]
];
const getByPath = (o, p) => p.includes('.') ? p.split('.').reduce((a, k) => a?.[k], o) : o?.[p];

/* ---------- 11.1. Синхронизация UI настроек ---------- */
function syncSettingsUI(s) {
    initThemeSelector(s.theme || 'rose');
    const d = DEFAULT_SETTINGS.appearance;
    val('theme-select', s.theme || 'rose');
    syncThemeSwatches(s.theme || 'rose');
    val('set-title', s.title || '');
    val('set-subtitle', s.subtitle || '');
    chk('set-smart-greeting', s.smartGreeting);
    val('set-city-a', s.cities?.[0] || '');
    val('set-city-b', s.cities?.[1] || '');

    val('set-clock-format', s.clockFormat === '12h' ? '12h' : '24h');
    chk('set-clock-seconds', s.clockSeconds !== false);
    chk('set-clock-date', s.clockDate);
    chk('set-hide-clocks', s.hideClocks);
    val('set-wx-unit', s.wxUnit || 'C');
    chk('set-wx-details', s.wxDetails);
    chk('set-open-newtab', s.openInNewTab);
    chk('set-auto-focus-search', s.autoFocusSearch);
    chk('set-search-shortcuts', s.searchShortcuts !== false);
    chk('set-save-history', s.saveSearchHistory !== false);
    chk('set-num-hotkeys', s.numHotkeys);
    chk('set-hide-chip-names', s.hideChipNames);
    chk('set-hide-avatar', s.hideAvatar);
    chk('set-hide-hero-text', s.hideHeroText);
    val('set-chip-style', s.chipStyle || 'cards');
    val('set-cat-columns', s.catColumns || 'auto');
    chk('set-hide-add-cat', s.hideAddCat);

    const bg = s.bg || {};
    val('set-bg-type', bg.type || 'none');
    val('set-bg-url', bg.url || '');
    setSlider('set-bg-opacity', bg.opacity ?? 100, '%');
    setSlider('set-bg-dim', bg.dim ?? 56, '%');
    setSlider('set-bg-blur', bg.blur ?? 0, 'px');
    setSlider('set-bg-scale', bg.scale ?? 100, '%');
    setSlider('set-bg-bright', bg.brightness ?? 100, '%');
    setSlider('set-bg-contrast', bg.contrast ?? 100, '%');
    setSlider('set-bg-sat', bg.saturate ?? 100, '%');

    const app = s.appearance || {};
    for (const [id, path, suf] of SLIDERS) setSlider(id, getByPath(app, path) ?? getByPath(d, path), suf);
    const fam = $('#set-font-family');
    if (fam) fam.value = app.font?.family || d.font.family;
    chk('set-animations', app.animations !== false);
    chk('set-cursor-glow', app.cursorGlow !== false);

    const cc = (s.customColor || '#ff4fa3').toLowerCase();
    val('set-custom-color', cc);
    val('set-custom-hex', cc);
}

/* ---------- 11.2. Применить ВСЁ из store к DOM ---------- */
async function applyEverything() {
    const s = await store.getSettings();
    s.bg = await repairBgMedia(s);
    await applyTheme(s.theme, false, s.customColor);
    applyAppearance(s.appearance);
    applyLayoutPreferences(s);
    await applyBackground(s);
    paintTitleAndSubtitle(s);
    paintAvatar(s.avatar || '', s.title);
    engine = ENGINES[s.engine] ? s.engine : 'google';
    qHistory = await store.getHistory();
    paintEngine();
    lastCitiesSig = '';
    initClocks(s);
    await renderCats();
    store.sig = JSON.stringify(s);
    const setOv = document.getElementById('settings-overlay');
    if (setOv && !setOv.hidden) syncSettingsUI(s);
}

let overlaysBound = false;
function bindOverlays() {
    if (overlaysBound) return;
    overlaysBound = true;
    on('settings-btn', 'click', openSettings);

    document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', e => { if (e.target === ov) toggleOverlay(ov, false); });
        ov.addEventListener('keydown', e => {
            if (e.key !== 'Tab') return;
            const focusables = [...ov.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
                .filter(el => !el.closest('[hidden]'));
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    });
    document.querySelectorAll('[data-close]').forEach(b => {
        b.addEventListener('click', () => toggleOverlay(document.getElementById(b.getAttribute('data-close')), false));
    });
}

let settingsBound = false;
function bindSettings() {
    if (settingsBound) return;
    settingsBound = true;

    const saveTitle = saveDebounced(v => updateSetting('title', v), 200);
    on('set-title', 'input', e => {
        const v = e.target.value;
        paintTitleAndSubtitle({ ...(settingsCache || DEFAULT_SETTINGS), title: v });
        saveTitle(v);
    });

    const saveSub = saveDebounced(v => updateSetting('subtitle', v), 200);
    on('set-subtitle', 'input', e => {
        const v = e.target.value;
        paintTitleAndSubtitle({ ...(settingsCache || DEFAULT_SETTINGS), subtitle: v });
        saveSub(v);
    });

    on('set-smart-greeting', 'change', async e => {
        const next = await updateSetting('smartGreeting', e.target.checked);
        paintTitleAndSubtitle(next);
    });

    const applyCity = async (idx, valStr) => {
        const next = await updateSetting('cities', prev => { const c = (prev || []).slice(); c[idx] = valStr; return c; });
        initClocks(next);
    };
    const bindCity = (id, idx) => {
        const deb = saveDebounced(v => applyCity(idx, v), 400);
        on(id, 'input', e => deb(e.target.value));
        on(id, 'change', e => { deb.cancel(); applyCity(idx, e.target.value); });
    };
    bindCity('set-city-a', 0);
    bindCity('set-city-b', 1);

    on('set-clock-format', 'change', async e => initClocks(await updateSetting('clockFormat', e.target.value)));
    on('set-clock-seconds', 'change', async e => initClocks(await updateSetting('clockSeconds', e.target.checked)));
    on('set-clock-date', 'change', async e => initClocks(await updateSetting('clockDate', e.target.checked)));
    on('set-hide-clocks', 'change', async e => {
        const next = await updateSetting('hideClocks', e.target.checked);
        applyLayoutPreferences(next);
        initClocks(next);
    });
    on('set-wx-unit', 'change', async e => initClocks(await updateSetting('wxUnit', e.target.value)));
    on('set-wx-details', 'change', async e => initClocks(await updateSetting('wxDetails', e.target.checked)));

    on('set-open-newtab', 'change', e => updateSetting('openInNewTab', e.target.checked));
    on('set-auto-focus-search', 'change', e => updateSetting('autoFocusSearch', e.target.checked));
    on('set-search-shortcuts', 'change', e => updateSetting('searchShortcuts', e.target.checked));
    on('set-save-history', 'change', e => updateSetting('saveSearchHistory', e.target.checked));
    on('set-num-hotkeys', 'change', async e => { await updateSetting('numHotkeys', e.target.checked); renderCats(categories); });
    on('set-hide-chip-names', 'change', async e => applyLayoutPreferences(await updateSetting('hideChipNames', e.target.checked)));
    on('set-hide-avatar', 'change', async e => applyLayoutPreferences(await updateSetting('hideAvatar', e.target.checked)));
    on('set-hide-hero-text', 'change', async e => applyLayoutPreferences(await updateSetting('hideHeroText', e.target.checked)));
    on('set-chip-style', 'change', async e => applyLayoutPreferences(await updateSetting('chipStyle', e.target.value)));
    on('set-cat-columns', 'change', async e => applyLayoutPreferences(await updateSetting('catColumns', e.target.value)));
    on('set-hide-add-cat', 'change', async e => applyLayoutPreferences(await updateSetting('hideAddCat', e.target.checked)));

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
        const type = e.target.value;
        const next = await updateSetting('bg', prev => type === 'none' ? { ...prev, type, idb: '' } : { ...prev, type });
        if (type === 'none') mediaDel(MEDIA_KEY).catch(() => {});
        await applyBackground(next);
    });
    on('set-bg-file', 'change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
            const type = f.type.indexOf('video') === 0 ? 'video' : 'image';
            const mediaBlob = type === 'image' ? await compressImageBlob(f, 2560) : f;
            await mediaPut(MEDIA_KEY, mediaBlob);
            const next = await updateSetting('bg', prev => ({ ...prev, type, url: '', idb: MEDIA_KEY }));
            val('set-bg-type', type); val('set-bg-url', '');
            await applyBackground(next); toast('Фон обновлён');
        } catch (err) {
            console.error('[KOCH] bg save:', err);
            toast('Не удалось сохранить файл фона', 'error');
        }
        e.target.value = '';
    });
    on('set-bg-url', 'change', async e => {
        const u = e.target.value.trim();
        const next = await updateSetting('bg', prev => {
            if (!u) return { ...prev, url: '', type: prev.idb ? prev.type : 'none' };
            const autoType = /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(u) || /^data:video\//i.test(u) ? 'video' : 'image';
            return { ...prev, type: prev.type === 'none' ? autoType : prev.type, url: u, idb: '' };
        });
        val('set-bg-type', next.bg.type);
        if (u) mediaDel(MEDIA_KEY).catch(err => console.warn('[KOCH] media del:', err));
        await applyBackground(next); toast('Фон обновлён');
    });
    const saveBgOp = saveDebounced(async v => {
        const next = await updateSetting('bg', prev => ({ ...prev, opacity: v }));
        bgAppliedSig = JSON.stringify(next.bg || {});
    }, 120);
    on('set-bg-opacity', 'input', e => {
        const v = parseInt(e.target.value, 10);
        txt('set-bg-opacity-val', v + '%');
        const op = v / 100;
        document.documentElement.style.setProperty('--bg-opacity', op);
        const vid = document.getElementById('bg-video'), img = document.getElementById('bg-image');
        if (vid && !vid.hidden) vid.style.opacity = op;
        if (img && !img.hidden) img.style.opacity = op;
        saveBgOp(v);
    });
    const saveBgDim = saveDebounced(async v => {
        const next = await updateSetting('bg', prev => ({ ...prev, dim: v }));
        bgAppliedSig = JSON.stringify(next.bg || {});
    }, 120);
    on('set-bg-dim', 'input', e => {
        const v = parseInt(e.target.value, 10);
        txt('set-bg-dim-val', v + '%');
        document.documentElement.style.setProperty('--bg-dim-op', v / 100);
        saveBgDim(v);
    });
    const intVal = (id, def) => {
        const n = parseInt(document.getElementById(id)?.value, 10);
        return isNaN(n) ? def : n;
    };
    const readBgFxFromUI = () => ({
        blur: intVal('set-bg-blur', 0),
        scale: intVal('set-bg-scale', 100),
        bright: intVal('set-bg-bright', 100),
        contrast: intVal('set-bg-contrast', 100),
        sat: intVal('set-bg-sat', 100)
    });
    const applyLiveBgFx = () => {
        const { blur, scale, bright, contrast, sat } = readBgFxFromUI();
        const st = document.documentElement.style;
        st.setProperty('--bg-blur', blur + 'px');
        st.setProperty('--bg-bright', bright + '%');
        st.setProperty('--bg-contrast', contrast + '%');
        st.setProperty('--bg-sat', sat + '%');
        st.setProperty('--bg-bf', buildBgFilter(blur, bright, contrast, sat));
        st.setProperty('--bg-scale', computeBgScale(scale, blur));
        document.documentElement.classList.toggle('bg-scaled', scale > 100 || blur > 0);
    };
    const bindBgFxSlider = (id, key, suf) => {
        const save = saveDebounced(async v => {
            const next = await updateSetting('bg', prev => ({ ...prev, [key]: v }));
            bgAppliedSig = JSON.stringify(next.bg || {});
        }, 120);
        on(id, 'input', e => {
            const v = parseInt(e.target.value, 10);
            txt(id + '-val', v + suf);
            applyLiveBgFx();
            save(v);
        });
    };
    bindBgFxSlider('set-bg-blur', 'blur', 'px');
    bindBgFxSlider('set-bg-scale', 'scale', '%');
    bindBgFxSlider('set-bg-bright', 'brightness', '%');
    bindBgFxSlider('set-bg-contrast', 'contrast', '%');
    bindBgFxSlider('set-bg-sat', 'saturate', '%');

    for (const [id, path, suf, step] of SLIDERS) bindSlider(id, path, suf, step);
    on('set-font-family', 'change', e => updateAppearanceSetting('font', prev => ({ ...prev, family: e.target.value })));
    on('set-animations', 'change', e => updateAppearanceSetting('animations', e.target.checked));
    on('set-cursor-glow', 'change', e => updateAppearanceSetting('cursorGlow', e.target.checked));

    const setOv = document.getElementById('settings-overlay');
    setOv?.addEventListener('input', e => { if (e.target.type === 'range') paintRange(e.target); });
    setOv?.addEventListener('dblclick', e => {
        if (e.target.type === 'range' && e.target.defaultValue !== '') {
            e.target.value = e.target.defaultValue;
            paintRange(e.target);
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
            const badge = document.getElementById(e.target.id + '-val');
            const dur = animDur(200);
            if (dur && badge) badge.animate?.([{ transform: 'scale(1.16)' }, { transform: 'none' }], { duration: dur, easing: EASE });
        }
    });

    let colorRaf = 0, latestHex = '';
    const saveCustomColor = saveDebounced(hex => setCustomColor(hex), 200);
    const previewCustomHex = hex => {
        latestHex = hex;
        if (!colorRaf) {
            colorRaf = requestAnimationFrame(() => {
                colorRaf = 0;
                document.documentElement.dataset.theme = 'custom';
                document.body.dataset.theme = 'custom';
                appliedTheme = 'custom';
                applyCustomThemeVars(latestHex);
                const sel = $('#theme-select'); if (sel) sel.value = 'custom';
                syncThemeSwatches('custom');
            });
        }
        saveCustomColor(latestHex);
    };
    on('set-custom-color', 'input', e => {
        const hex = e.target.value.toLowerCase();
        val('set-custom-hex', hex);
        previewCustomHex(hex);
    });
    on('set-custom-hex', 'input', e => {
        const raw = e.target.value.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
            const hex = (raw[0] === '#' ? raw : '#' + raw).toLowerCase();
            val('set-custom-color', hex);
            previewCustomHex(hex);
        }
    });
    on('set-custom-hex', 'change', e => {
        let hex = e.target.value.trim();
        if (/^#?[0-9a-fA-F]{3}$/.test(hex)) {
            const h = hex.replace('#', '');
            hex = '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) { toast('HEX вида #rrggbb', 'error'); return; }
        if (hex[0] !== '#') hex = '#' + hex;
        hex = hex.toLowerCase();
        saveCustomColor.cancel();
        val('set-custom-color', hex);
        val('set-custom-hex', hex);
        setCustomColor(hex);
    });

    /* ====== ЭКСПОРТ ====== */
    on('export-btn', 'click', async () => {
        try {
            flushPendingSaves();
            const json = await store.exportAll({ includeMedia: true });
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `koch-brauzer-full-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            const kb = Math.round(blob.size / 1024);
            toast(`Экспортировано (${kb >= 1024 ? (kb / 1024).toFixed(1) + ' МБ' : kb + ' КБ'})`);
        } catch (err) {
            console.error('[KOCH] export:', err);
            toast('Ошибка экспорта: ' + err.message, 'error');
        }
    });

    /* ====== ИМПОРТ ====== */
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

    on('reset-sliders-btn', 'click', async () => {
        cancelPendingSaves();
        const next = await store.updateSettings(s => ({
            ...s,
            bg: { ...DEFAULT_SETTINGS.bg, type: s.bg?.type || 'none', url: s.bg?.url || '', idb: s.bg?.idb || '' },
            appearance: clone(DEFAULT_SETTINGS.appearance)
        }));
        applyAppearance(next.appearance);
        await applyBackground(next);
        syncSettingsUI(next);
        toast('Параметры вида сброшены');
    });

    on('reset-btn', 'click', async e => {
        if (!armConfirm(e.currentTarget, 'Точно сбросить?')) return;
        await store.reset();
        invalidateRuntimeState();
        closeOverlays();
        await applyEverything();
        toast('Настройки сброшены');
    });
}

function setSlider(inputId, value, suffix) {
    val(inputId, value);
    txt(inputId + '-val', fmtNum(value) + suffix);
}

async function openSettings() {
    bindSettings();
    syncSettingsUI(settingsCache || await store.getSettings());
    toggleOverlay(document.getElementById('settings-overlay'), true, '#theme-select');
}

/* ---------- 12. Запуск ---------- */
window.addEventListener('error', e => {
    console.error('[KOCH] Error:', e.error || e.message);
    toast('Ошибка — смотри консоль (F12)', 'error');
});
window.addEventListener('unhandledrejection', e => console.error('[KOCH] Rejection:', e.reason));

function initThemeSelector(cur) {
    const sel = $('#theme-select');
    if (sel) {
        if (!sel.options.length) {
            sel.append(...Object.entries(THEMES).map(([id, name]) => el('option', { value: id }, name)));
            sel.addEventListener('change', () => applyTheme(sel.value, true));
        }
        sel.value = cur;
    }
    const swatches = $('#theme-swatches');
    if (swatches && !swatches.children.length) {
        swatches.append(...Object.entries(THEMES).map(([id, name]) =>
            el('button', {
                type: 'button',
                class: ['swatch-btn', id === cur ? 'active' : ''],
                role: 'radio',
                'aria-checked': String(id === cur),
                dataset: { swatch: id },
                onClick: e => {
                    const dur = animDur(200);
                    if (dur) e.currentTarget.animate?.([{ transform: 'scale(.93)' }, { transform: 'scale(1.03)' }, { transform: 'none' }], { duration: dur, easing: EASE });
                    applyTheme(id, true);
                }
            },
            el('span', { class: 'swatch-dot', style: { background: THEME_SWATCH_COLORS[id] || '#ff4fa3' } }),
            name)
        ));
    } else {
        syncThemeSwatches(cur);
    }
}

let keysBound = false;
function bindKeys() {
    if (keysBound) return;
    keysBound = true;
    const focusSearchWithPulse = selectAll => {
        const inp = searchInput();
        if (!inp) return;
        inp.focus();
        if (selectAll) inp.select();
        const dur = animDur(180);
        if (dur) $('.search-bar')?.animate?.([{ transform: 'scale(1.012)' }, { transform: 'none' }], { duration: dur, easing: EASE });
    };
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            closeOverlays();
            focusSearchWithPulse(true);
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            const setOv = document.getElementById('settings-overlay');
            if (setOv && !setOv.hidden && !setOv.classList.contains('closing')) toggleOverlay(setOv, false);
            else { closeOverlays(); openSettings(); }
            return;
        }
        const active = document.activeElement;
        const tag = active?.tagName;
        const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable;
        const hasModal = !!document.querySelector('.overlay:not([hidden]):not(.closing)');
        if (!inInput && !hasModal && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.key === '/') {
                e.preventDefault();
                focusSearchWithPulse(false);
                return;
            }
            if (settingsCache?.numHotkeys && /^[1-9]$/.test(e.key)) {
                const chip = document.querySelectorAll('#cats .chip')[parseInt(e.key, 10) - 1];
                if (chip) {
                    e.preventDefault();
                    openChipUrl(chip, e.shiftKey);
                    return;
                }
            }
        }
        if (e.key === 'Escape') {
            closeOverlays();
            hideSuggest();
        }
    });
}

let cursorGlowBound = false;
function bindCursorGlow() {
    if (cursorGlowBound) return;
    cursorGlowBound = true;
    const GLOW_SEL = '.chip, .clock-wx, .clock-card, .cat-card, .search-bar, .add-cat, .pill-btn';
    let raf = 0, cx = 0, cy = 0;
    let activeEl = null, activeRect = null;
    let parentCard = null, parentRect = null;

    const invalidateRects = () => { activeRect = null; parentRect = null; };
    window.addEventListener('scroll', invalidateRects, { passive: true });
    window.addEventListener('resize', invalidateRects, { passive: true });

    document.addEventListener('pointerover', e => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        const hit = e.target?.closest?.(GLOW_SEL) || null;
        if (hit !== activeEl) {
            activeEl = hit;
            activeRect = null;
            parentCard = (hit && (hit.classList.contains('chip') || hit.classList.contains('clock-wx')))
                ? hit.closest('.cat-card, .clock-card')
                : null;
            parentRect = null;
        }
    }, { passive: true });

    document.addEventListener('pointermove', e => {
        if (!activeEl || (e.pointerType && e.pointerType !== 'mouse') || !isPageActive()) return;
        if (document.documentElement.classList.contains('no-cursor-glow')) return;
        cx = e.clientX;
        cy = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            if (activeEl && activeEl.isConnected) {
                if (!activeRect) activeRect = activeEl.getBoundingClientRect();
                activeEl.style.setProperty('--mx', `${Math.round(cx - activeRect.left)}px`);
                activeEl.style.setProperty('--my', `${Math.round(cy - activeRect.top)}px`);
            }
            if (parentCard && parentCard.isConnected) {
                if (!parentRect) parentRect = parentCard.getBoundingClientRect();
                parentCard.style.setProperty('--mx', `${Math.round(cx - parentRect.left)}px`);
                parentCard.style.setProperty('--my', `${Math.round(cy - parentRect.top)}px`);
            }
        });
    }, { passive: true });
}

async function boot() {
    const start = performance.now();
    try {
        const { settings: s, categories: cats, history } = await store.boot();
        s.bg = await repairBgMedia(s);
        await applyTheme(s.theme, false, s.customColor);
        applyAppearance(s.appearance);
        applyLayoutPreferences(s);
        paintTitleAndSubtitle(s);
        paintAvatar(s.avatar || '', s.title);

        setupVideoVisibility();
        initClocks(s);

        applyBackground(s);
        const searchReady = initSearch(s, history);
        bindCatModal(); bindOverlays(); bindKeys(); bindCursorGlow();
        $('#avatar')?.addEventListener('click', e => {
            const dur = animDur(240);
            if (dur) e.currentTarget.animate?.([{ transform: 'scale(.92)' }, { transform: 'scale(1.06)' }, { transform: 'none' }], { duration: dur, easing: EASE });
        });
        await Promise.all([searchReady, renderCats(cats)]);
        if (s.autoFocusSearch) searchInput()?.focus({ preventScroll: true });

        const sync = debounce(async next => {
            if (!next) return;
            const sig = JSON.stringify(next);
            if (sig === store.sig) return;
            store.sig = sig;
            await applyTheme(next.theme, false, next.customColor);
            applyAppearance(next.appearance);
            applyLayoutPreferences(next);
            if (JSON.stringify(next.bg || {}) !== bgAppliedSig) await applyBackground(next);
            paintTitleAndSubtitle(next);
            paintAvatar(next.avatar || '', next.title);
            if (ENGINES[next.engine] && next.engine !== engine) { engine = next.engine; paintEngine(); }
            const sel = $('#theme-select'); if (sel) sel.value = next.theme || 'rose';
            syncThemeSwatches(next.theme || 'rose');
            const nextClockSig = JSON.stringify({
                cities: next.cities || [],
                hour12: next.clockFormat === '12h',
                seconds: next.clockSeconds !== false,
                date: !!next.clockDate,
                hideClocks: !!next.hideClocks,
                wxUnit: next.wxUnit === 'F' ? 'F' : 'C',
                wxDetails: !!next.wxDetails
            });
            if (nextClockSig !== clockConfigSig) initClocks(next);
            renderCats(categories);
            const setOv = document.getElementById('settings-overlay');
            if (setOv && !setOv.hidden) syncSettingsUI(next);
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

setTimeout(() => document.documentElement.classList.remove('intro'), 800);
