/**
 * Категории: табы, сортировка, закрепление, сворачивание.
 */

import { $, el, toast } from './utils.js';
import { storage } from './storage.js';
import { renderCategories as renderShortcuts } from './shortcuts.js';

export const state = {
  categories: [],
  activeCategory: 'all'
};

export async function loadCategories() {
  state.categories = await storage.get('categories');
}

export async function saveCategories() {
  await storage.set('categories', state.categories);
}

export function renderCategoryTabs() {
  const wrap = $('#categories-tabs');
  if (!wrap) return;
  wrap.innerHTML = '';

  const sorted = [...state.categories].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  sorted.forEach(cat => {
    const btn = el('button', {
      class: `cat-tab ${cat.id === state.activeCategory ? 'active' : ''} ${cat.pinned ? 'pinned' : ''}`,
      'data-id': cat.id,
      draggable: 'true'
    }, cat.name);

    btn.addEventListener('click', () => {
      state.activeCategory = cat.id;
      renderCategoryTabs();
      renderShortcuts();
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openCategoryEditor(cat.id);
    });

    attachTabDrag(btn, cat.id);
    wrap.appendChild(btn);
  });

  const addBtn = el('button', {
    class: 'cat-tab',
    style: 'opacity:0.6;',
    onclick: () => openCategoryEditor(null)
  }, '＋');
  wrap.appendChild(addBtn);
}

function attachTabDrag(node, id) {
  node.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', id);
  });
  node.addEventListener('dragover', (e) => e.preventDefault());
  node.addEventListener('drop', async (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === id) return;

    // Если это категория — меняем порядок категорий
    if (state.categories.find(c => c.id === draggedId)) {
      const dragIdx = state.categories.findIndex(c => c.id === draggedId);
      const targetIdx = state.categories.findIndex(c => c.id === id);
      const [moved] = state.categories.splice(dragIdx, 1);
      state.categories.splice(targetIdx, 0, moved);
      state.categories.forEach((c, i) => c.order = i);
      await saveCategories();
      renderCategoryTabs();
    }
  });
}

export async function addCategory(name) {
  state.categories.push({
    id: `cat-${Date.now()}`,
    name,
    order: state.categories.length,
    collapsed: false,
    pinned: false
  });
  await saveCategories();
  renderCategoryTabs();
  toast('Категория добавлена');
}

export async function renameCategory(id, newName) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  c.name = newName;
  await saveCategories();
  renderCategoryTabs();
}

export async function deleteCategory(id) {
  if (id === 'all') { toast('Нельзя удалить "Все"', 'error'); return; }
  state.categories = state.categories.filter(c => c.id !== id);
  await saveCategories();
  state.activeCategory = 'all';
  renderCategoryTabs();
  renderShortcuts();
  toast('Категория удалена');
}

export async function togglePinCategory(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  c.pinned = !c.pinned;
  await saveCategories();
  renderCategoryTabs();
}

function openCategoryEditor(id) {
  const cat = id ? state.categories.find(c => c.id === id) : null;
  const name = prompt(cat ? 'Переименовать категорию:' : 'Название новой категории:', cat?.name || '');
  if (name === null) return;
  if (!name.trim()) return;

  if (cat) {
    if (confirm(`Удалить категорию "${cat.name}"?`)) {
      deleteCategory(cat.id);
    } else {
      renameCategory(cat.id, name.trim());
    }
  } else {
    addCategory(name.trim());
  }
}