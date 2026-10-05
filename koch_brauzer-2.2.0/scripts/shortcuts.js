/**
 * Категории + ярлыки: рендер, добавление, редактирование,
 * удаление, переименование, drag & drop между категориями.
 */

import { el, uid, faviconOf, normUrl, toast } from './utils.js';

let data = null;   // общие данные (мутация + save)
let save = null;
let modalCtx = null; // { cat, id } — куда/что добавляем-редактируем

/** Инициализация модуля общими данными */
export function initShortcuts(d, saveFn) {
  data = d;
  save = saveFn;
  bindModal();
}

/* ================= РЕНДЕР ================= */

export function renderCategories() {
  const root = document.getElementById('categories');
  root.innerHTML = '';
  for (const cat of data.categories) root.appendChild(buildCategory(cat));
}

function buildCategory(cat) {
  const card = el('div', { class: 'cat-card', dataset: { cat: cat.id } });

  const header = el('div', { class: 'cat-header' },
    el('span', { class: 'cat-icon' }, cat.icon || '📁'),
    el('span', { class: 'cat-name' }, cat.name),
    el('span', { class: 'cat-tools' },
      el('button', { class: 'tool', title: 'Переименовать',
        onclick: (e) => { e.stopPropagation(); renameCategory(cat.id); } }, '✎'),
      el('button', { class: 'tool', title: 'Удалить категорию',
        onclick: (e) => { e.stopPropagation(); deleteCategory(cat.id); } }, '🗑'),
      el('button', { class: 'tool', title: 'Добавить ярлык',
        onclick: (e) => { e.stopPropagation(); openModal(cat.id); } }, '＋')
    )
  );

  const tiles = el('div', { class: 'tiles' });
  for (const s of data.shortcuts.filter(s => s.cat === cat.id)) {
    tiles.appendChild(buildTile(s));
  }

  card.append(header, tiles);

  /* --- Drag & Drop: карточка как зона приёма --- */
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const s = data.shortcuts.find(x => x.id === id);
    if (!s || s.cat === cat.id) return;
    s.cat = cat.id;
    save();
    renderCategories();
    toast(`Перемещено в «${cat.name}»`);
  });

  return card;
}

function buildTile(s) {
  const tile = el('div', { class: 'tile', draggable: 'true', dataset: { id: s.id } },
    el('div', { class: 'tile-actions' },
      el('button', { title: 'Изменить',
        onclick: (e) => { e.stopPropagation(); openModal(s.cat, s); } }, '✎'),
      el('button', { title: 'Удалить',
        onclick: (e) => { e.stopPropagation(); deleteShortcut(s.id); } }, '🗑')
    ),
    el('div', { class: 'tile-icon' }, makeIcon(s)),
    el('div', { class: 'tile-name' }, s.title)
  );

  tile.addEventListener('click', () => { window.location.href = s.url; });
  tile.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', s.id);
    e.dataTransfer.effectAllowed = 'move';
    tile.classList.add('dragging');
  });
  tile.addEventListener('dragend', () => tile.classList.remove('dragging'));

  return tile;
}

/** Иконка: эмодзи/текст или картинка (favicon), с fallback */
function makeIcon(s) {
  if (s.icon && !/^https?:/i.test(s.icon)) {
    return el('span', { class: 'emoji' }, s.icon);
  }
  const img = el('img', { src: s.icon || faviconOf(s.url), alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(el('span', { class: 'emoji' }, '🌐')));
  return img;
}

/* ================= ОПЕРАЦИИ ================= */

function deleteShortcut(id) {
  data.shortcuts = data.shortcuts.filter(s => s.id !== id);
  save();
  renderCategories();
  toast('Ярлык удалён');
}

function renameCategory(id) {
  const cat = data.categories.find(c => c.id === id);
  if (!cat) return;
  const name = prompt('Название категории:', cat.name);
  if (!name || !name.trim()) return;
  cat.name = name.trim().toUpperCase();
  save();
  renderCategories();
}

function deleteCategory(id) {
  const cat = data.categories.find(c => c.id === id);
  if (!cat) return;
  if (!confirm(`Удалить категорию «${cat.name}» и все её ярлыки?`)) return;
  data.categories = data.categories.filter(c => c.id !== id);
  data.shortcuts  = data.shortcuts.filter(s => s.cat !== id);
  save();
  renderCategories();
  toast('Категория удалена');
}

/* ================= МОДАЛКА ================= */

function bindModal() {
  const modal = document.getElementById('shortcut-modal');
  const form  = document.getElementById('shortcut-form');

  document.getElementById('modal-cancel')
    .addEventListener('click', () => modal.close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements; // ВАЖНО: form.elements, а не form.title (баг HTMLElement.title)
    const value = {
      title: f['title'].value.trim(),
      url:   normUrl(f['url'].value),
      icon:  f['icon'].value.trim()
    };
    if (!value.title || !value.url) return;

    if (modalCtx?.id) {
      const s = data.shortcuts.find(x => x.id === modalCtx.id);
      if (s) Object.assign(s, value);
      toast('Сохранено');
    } else {
      data.shortcuts.push({ id: uid(), cat: modalCtx.cat, ...value });
      toast('Ярлык добавлен');
    }
    save();
    renderCategories();
    modal.close();
  });
}

function openModal(catId, shortcut = null) {
  modalCtx = { cat: catId, id: shortcut?.id || null };
  const modal = document.getElementById('shortcut-modal');
  const f = document.getElementById('shortcut-form').elements;
  f['title'].value = shortcut?.title || '';
  f['url'].value   = shortcut?.url   || '';
  f['icon'].value  = shortcut?.icon  || '';
  document.getElementById('modal-heading').textContent =
    shortcut ? 'Изменить ярлык' : 'Новый ярлык';
  modal.showModal();
}