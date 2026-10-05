/** Категории + ярлыки. Исправлено: draggable теперь реально работает, favicon с фолбэком. */

import { $, el, uid, toast, faviconOf, normalizeUrl } from './utils.js';
import { store } from './storage.js';

let categories = [];
let scModal = { catId: null, scId: null };

export async function renderCats() {
  categories = await store.get('categories');
  const wrap = $('#cats');
  if (!wrap) return;
  wrap.innerHTML = '';
  categories.forEach((cat, ci) => wrap.append(buildCard(cat, ci)));
}

function buildCard(cat, ci) {
  const card = el('div', { class: 'cat-card' });
  card.style.animationDelay = `${0.42 + ci * 0.07}s`;

  const head = el('div', {
    class: 'cat-head', draggable: true,
    title: 'Тяни для порядка · ПКМ — переименовать/удалить'
  },
    el('span', { class: 'cat-ico' }, cat.icon || '📁'),
    el('span', { class: 'cat-name' }, cat.name),
    el('button', {
      class: 'cat-add', title: 'Добавить ярлык',
      onclick: (e) => { e.stopPropagation(); openScModal(cat.id, null); }
    }, '＋')
  );

  head.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const action = prompt(`Категория «${cat.name}»:\n1 — переименовать\n2 — удалить`, '1');
    if (action === '1') {
      const name = prompt('Новое название:', cat.name);
      if (name && name.trim()) { cat.name = name.trim().toUpperCase(); save(); }
    } else if (action === '2') {
      categories = categories.filter(c => c.id !== cat.id);
      save(); toast('Категория удалена');
    }
  });

  head.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'cat', id: cat.id }));
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    let data;
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
    if (data.type === 'chip') moveChip(data.catId, data.id, cat.id);
    else if (data.type === 'cat' && data.id !== cat.id) moveCat(data.id, cat.id);
  });

  const chips = el('div', { class: 'chips' });
  (cat.shortcuts || []).forEach((sc, si) => chips.append(buildChip(cat, sc, si)));

  card.append(head, chips);
  return card;
}

function buildChip(cat, sc, si) {
  const chip = el('div', {
    class: 'chip', draggable: true,
    onclick: () => { const u = normalizeUrl(sc.url); if (u) location.href = u; }
  });
  chip.style.animationDelay = `${si * 0.05}s`;

  // Иконка с фолбэком 🌐 при ошибке загрузки
  let ico;
  if (sc.icon && (/^https?:/.test(sc.icon) || sc.icon.startsWith('data:'))) {
    ico = el('img', {
      src: sc.icon, alt: '',
      onerror: (e) => e.target.replaceWith(el('span', {}, '🌐'))
    });
  } else if (sc.icon) {
    ico = el('span', {}, sc.icon);
  } else {
    ico = el('img', {
      src: faviconOf(sc.url), alt: '',
      onerror: (e) => e.target.replaceWith(el('span', {}, '🌐'))
    });
  }

  chip.append(
    el('div', { class: 'chip-tools' },
      el('button', { title: 'Изменить', onclick: (e) => { e.stopPropagation(); openScModal(cat.id, sc.id); } }, '✎'),
      el('button', { title: 'Удалить', onclick: (e) => {
        e.stopPropagation();
        cat.shortcuts = cat.shortcuts.filter(x => x.id !== sc.id);
        save(); toast('Ярлык удалён');
      } }, '✕')
    ),
    el('div', { class: 'chip-ico' }, ico),
    el('div', { class: 'chip-name', title: sc.title }, sc.title)
  );

  chip.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chip', catId: cat.id, id: sc.id }));
    e.dataTransfer.effectAllowed = 'move';
    chip.classList.add('dragging');
  });
  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
  return chip;
}

async function save() {
  await store.set('categories', categories);
  renderCats();
}

function moveChip(fromCat, scId, toCat) {
  const src = categories.find(c => c.id === fromCat);
  const dst = categories.find(c => c.id === toCat);
  if (!src || !dst || fromCat === toCat) return;
  const idx = src.shortcuts.findIndex(x => x.id === scId);
  if (idx === -1) return;
  const [sc] = src.shortcuts.splice(idx, 1);
  dst.shortcuts.push(sc);
  save();
}

function moveCat(dragId, targetId) {
  const from = categories.findIndex(c => c.id === dragId);
  const to   = categories.findIndex(c => c.id === targetId);
  if (from === -1 || to === -1) return;
  const [c] = categories.splice(from, 1);
  categories.splice(to, 0, c);
  save();
}

/* ---------- Модалка ярлыка ---------- */
export function bindScModal() {
  $('#sc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const cat = categories.find(c => c.id === scModal.catId);
    if (!cat) return;
    const data = {
      title: $('#sc-name').value.trim(),
      url: normalizeUrl($('#sc-url').value) || $('#sc-url').value.trim(),
      icon: $('#sc-icon').value.trim()
    };
    if (!data.title || !data.url) return;

    if (scModal.scId) {
      const sc = cat.shortcuts.find(x => x.id === scModal.scId);
      if (sc) Object.assign(sc, data);
      toast('Ярлык обновлён');
    } else {
      cat.shortcuts.push(Object.assign({ id: uid() }, data));
      toast('Ярлык добавлен');
    }
    closeScModal();
    save();
  });

  $('#sc-delete').addEventListener('click', () => {
    const cat = categories.find(c => c.id === scModal.catId);
    if (cat) cat.shortcuts = cat.shortcuts.filter(x => x.id !== scModal.scId);
    closeScModal();
    save();
    toast('Ярлык удалён');
  });
}

function openScModal(catId, scId) {
  scModal = { catId, scId };
  const cat = categories.find(c => c.id === catId);
  const sc = cat ? (cat.shortcuts || []).find(x => x.id === scId) : null;
  $('#sc-name').value = sc ? sc.title : '';
  $('#sc-url').value  = sc ? sc.url : '';
  $('#sc-icon').value = sc ? sc.icon : '';
  $('#sc-delete').hidden = !sc;
  $('#sc-title-head').textContent = sc ? 'Изменить ярлык' : 'Новый ярлык';
  $('#sc-overlay').hidden = false;
}

export function closeScModal() { $('#sc-overlay').hidden = true; }

export function bindAddCat() {
  $('#add-cat').addEventListener('click', () => {
    const name = prompt('Название категории:');
    if (!name || !name.trim()) return;
    const icon = prompt('Эмодзи-иконка:', '⭐') || '⭐';
    categories.push({ id: uid(), icon: icon.trim(), name: name.trim().toUpperCase(), shortcuts: [] });
    save();
    toast('Категория добавлена');
  });
}
