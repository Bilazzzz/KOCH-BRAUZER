/** Поиск: движки, история, подсказки. */

import { $, el, debounce, normalizeUrl } from './utils.js';
import { store } from './storage.js';

const ENGINES = {
  google: { label: 'G',  name: 'Google',       url: 'https://www.google.com/search?q=' },
  ddg:    { label: 'DD', name: 'DuckDuckGo',   url: 'https://duckduckgo.com/?q=' },
  bing:   { label: 'B',  name: 'Bing',         url: 'https://www.bing.com/search?q=' },
  yandex: { label: 'Я',  name: 'Яндекс',       url: 'https://yandex.ru/search/?text=' },
  brave:  { label: 'BS', name: 'Brave Search', url: 'https://search.brave.com/search?q=' }
};

let engine = 'google';
let history = [];

const input   = () => $('#search-input');
const suggest = () => $('#suggest');
const list    = () => $('#suggest-list');

export async function initSearch() {
  const s = await store.get('settings');
  engine = ENGINES[s.engine] ? s.engine : 'google';
  history = (await store.get('history')) || [];
  paintEngine();
  bind();
}

function paintEngine() {
  const btn = $('#engine-btn');
  if (!btn) return;
  btn.textContent = ENGINES[engine].label;
  btn.title = 'Поисковик: ' + ENGINES[engine].name;
  input().placeholder = `Поиск в ${ENGINES[engine].name}…`;
}

function bind() {
  $('#engine-btn').addEventListener('click', () => {
    const keys = Object.keys(ENGINES);
    engine = keys[(keys.indexOf(engine) + 1) % keys.length];
    store.update('settings', s => ({ ...s, engine }));
    paintEngine();
  });

  input().addEventListener('input', debounce(renderSuggest, 90));
  input().addEventListener('focus', renderSuggest);
  input().addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
    if (e.key === 'Escape') hide();
  });
  $('#search-go').addEventListener('click', go);
  $('#clear-history').addEventListener('click', async () => {
    history = [];
    await store.set('history', []);
    renderSuggest();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-row')) hide();
  });
}

function renderSuggest() {
  const q = input().value.trim().toLowerCase();
  const items = history.filter(h => !q || h.q.toLowerCase().includes(q)).slice(0, 8);

  const ul = list();
  ul.innerHTML = '';
  items.forEach(h => {
    ul.append(el('li', { onclick: () => { input().value = h.q; go(); } },
      el('span', {}, '🕒'),
      el('span', { class: 'q' }, h.q),
      el('button', {
        class: 'del', title: 'Удалить',
        onclick: (e) => {
          e.stopPropagation();
          history = history.filter(x => x.id !== h.id);
          store.set('history', history);
          renderSuggest();
        }
      }, '✕')
    ));
  });
  suggest().hidden = items.length === 0;
}

function hide() { suggest().hidden = true; }

async function go() {
  const raw = input().value.trim();
  if (!raw) return;
  const asUrl = normalizeUrl(raw);
  const isUrl = /^https?:\/\//i.test(raw) || (asUrl !== '' && !raw.includes(' '));

  if (!isUrl) {
    history = [{ id: String(Date.now()), q: raw }, ...history.filter(h => h.q !== raw)].slice(0, 50);
    await store.set('history', history);
  }
  hide();
  location.href = isUrl ? asUrl : ENGINES[engine].url + encodeURIComponent(raw);
}
