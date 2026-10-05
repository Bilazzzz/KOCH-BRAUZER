/** Базовые утилиты. Исправлено: корректная установка boolean-атрибутов (draggable и т.п.). */

export const $  = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Создание элемента. attrs: class, dataset, on* = функции, остальное — атрибуты. */
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      n.addEventListener(k.slice(2), v);
    } else if (k === 'class') {
      n.className = v;
    } else if (k === 'dataset') {
      Object.assign(n.dataset, v);
    } else {
      // true → "true" (важно для draggable!), false пропускается выше
      n.setAttribute(k, v === true ? 'true' : String(v));
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/** Уведомление */
export function toast(msg) {
  const box = $('#toasts');
  if (!box) { console.log('[KOCH]', msg); return; }
  const t = el('div', { class: 'toast' }, msg);
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 2400);
}

/** Favicon сайта */
export function faviconOf(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return ''; }
}

export function normalizeUrl(str) {
  str = (str || '').trim();
  if (!str) return '';
  if (/^https?:\/\//i.test(str)) return str;
  if (str.includes('.') && !str.includes(' ')) return 'https://' + str;
  return '';
}
export const normUrl = normalizeUrl;

export const readFileAsDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error('read error'));
  r.readAsDataURL(file);
});

/** Форматирование времени и даты */
export const fmtTime = (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d) => d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
