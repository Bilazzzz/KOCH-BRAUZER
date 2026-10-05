/** Хранилище. Поддержка как Chrome-расширения, так и обычных браузеров (localStorage). */

const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

const DEFAULTS = {
  settings: {
    theme: 'rose',
    subtitle: 'твоя стартовая страница',
    cities: ['Воткинск', 'Уральск'],
    avatar: '',
    bg: { type: 'none', url: '' },
    engine: 'google'
  },
  categories: [
    { id: 'c1', icon: '🌐', name: 'Соцсети', shortcuts: [
      { id: 's1', title: 'YouTube',  url: 'https://youtube.com',      icon: '' },
      { id: 's2', title: 'Telegram', url: 'https://web.telegram.org', icon: '' },
      { id: 's3', title: 'VK',       url: 'https://vk.com',           icon: '' },
      { id: 's4', title: 'Discord',  url: 'https://discord.com',      icon: '' }
    ]},
    { id: 'c2', icon: '🎵', name: 'Музыка', shortcuts: [
      { id: 's5', title: 'Spotify',    url: 'https://open.spotify.com', icon: '' },
      { id: 's6', title: 'SoundCloud', url: 'https://soundcloud.com',   icon: '' },
      { id: 's7', title: 'Я Музыка',   url: 'https://music.yandex.ru',  icon: '' }
    ]},
    { id: 'c3', icon: '🎮', name: 'Игры', shortcuts: [
      { id: 's8',  title: 'Steam',      url: 'https://steampowered.com',    icon: '' },
      { id: 's9',  title: 'Twitch',     url: 'https://twitch.tv',           icon: '' },
      { id: 's10', title: 'Epic Games', url: 'https://store.epicgames.com', icon: '' }
    ]},
    { id: 'c4', icon: '💻', name: 'Разработка', shortcuts: [
      { id: 's11', title: 'GitHub',        url: 'https://github.com',          icon: '' },
      { id: 's12', title: 'StackOverflow', url: 'https://stackoverflow.com',   icon: '' },
      { id: 's13', title: 'Reddit',        url: 'https://reddit.com',          icon: '' }
    ]}
  ],
  history: []
};

const KEYS = Object.keys(DEFAULTS);
const PREFIX = 'kb_';

// Определяем, запущены ли мы в среде Chrome-расширения
const isExtension =
  typeof chrome !== 'undefined' &&
  chrome.storage &&
  chrome.storage.local &&
  typeof chrome.storage.local.get === 'function';

// --- Fallback для localStorage ---
const mockStorage = {
  async get(keys) {
    const res = {};
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) {
      const raw = localStorage.getItem(PREFIX + k);
      if (raw !== null) {
        try {
          res[k] = JSON.parse(raw);
        } catch {
          res[k] = raw;
        }
      }
    }
    return res;
  },

  async set(obj) {
    for (const [k, v] of Object.entries(obj)) {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    }
  },

  async clear() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    });
  }
};

const mockOnChanged = {
  listeners: [],
  addListener(fn) {
    this.listeners.push(fn);
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      const key = e.key.slice(PREFIX.length);
      const newValue = e.newValue === null ? undefined : JSON.parse(e.newValue);
      const oldValue = e.oldValue === null ? undefined : JSON.parse(e.oldValue);
      fn({ [key]: { newValue, oldValue } }, 'local');
    });
  }
};

const storageLocal = isExtension ? chrome.storage.local : mockStorage;
const storageOnChanged = isExtension ? chrome.storage.onChanged : mockOnChanged;

export const store = {
  async get(key) {
    try {
      const data = await storageLocal.get(key ? [key] : KEYS);
      if (key) return data[key] !== undefined ? data[key] : clone(DEFAULTS[key]);
      return KEYS.reduce((acc, k) => {
        acc[k] = data[k] !== undefined ? data[k] : clone(DEFAULTS[k]);
        return acc;
      }, {});
    } catch (e) {
      console.error('[KOCH storage]', e);
      if (key) return clone(DEFAULTS[key]);
      return clone(DEFAULTS);
    }
  },

  set(key, value) { return storageLocal.set({ [key]: value }); },

  async update(key, fn) {
    const next = fn(await this.get(key));
    await this.set(key, next);
    return next;
  },

  async reset() { await storageLocal.clear(); },

  async exportAll() { return JSON.stringify(await this.get(), null, 2); },

  async importAll(text) {
    const data = JSON.parse(text);
    const clean = {};
    KEYS.forEach(k => { if (data[k] !== undefined) clean[k] = data[k]; });
    await storageLocal.set(clean);
  },

  onChange(key, fn) {
    storageOnChanged.addListener((changes, area) => {
      if (area === 'local' && changes[key]) fn(changes[key].newValue);
    });
  }
};

export const storage = store;