/** Точка входа + диагностика ошибок. */

import { $, toast } from './utils.js';
import { store } from './storage.js';
import { THEMES, applyTheme, applyBackground } from './theme.js';
import { initClocks } from './clocks.js';
import { initSearch } from './search.js';
import { renderCats, bindScModal, bindAddCat, closeScModal } from './cats.js';
import { bindSettings, paintAvatar } from './settings.js';

// Видимая диагностика: любая ошибка JS попадёт в тост и консоль
window.addEventListener('error', (e) => {
  console.error('[KOCH BRAUZER]', e.error || e.message);
  toast('Ошибка JS — смотри консоль (F12)');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[KOCH BRAUZER] unhandled promise:', e.reason);
});

async function boot() {
  // Проверяем, запущены ли мы в среде Chrome-расширения.
  // Если нет, мы используем localStorage через storage.js, но при этом приложение
  // полностью функционально и работает в любом браузере (Firefox, Safari, Chrome и т.д.).
  const isExtension =
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local &&
    typeof chrome.storage.local.get === 'function';

  if (!isExtension) {
    console.info('[KOCH BRAUZER] Запуск в автономном режиме (используется localStorage).');
  }

  const s = await store.get('settings');

  // Селектор тем
  const sel = $('#theme-select');
  sel.innerHTML = '';
  Object.keys(THEMES).forEach(id => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = THEMES[id];
    if (id === s.theme) o.selected = true;
    sel.append(o);
  });
  sel.addEventListener('change', () => applyTheme(sel.value, true));

  // Применение БЕЗ записи → нет цикла storage
  await applyTheme(s.theme, false);
  await applyBackground();
  $('#subtitle').textContent = s.subtitle || '';
  paintAvatar(s.avatar || '');

  initClocks();
  initSearch();
  renderCats();
  bindAddCat();
  bindScModal();
  bindSettings();
  bindKeys();

  // Синхронизация между вкладками (только чтение → применение)
  store.onChange('settings', async (next) => {
    if (!next) return;
    await applyTheme(next.theme, false);
    await applyBackground();
    $('#subtitle').textContent = next.subtitle || '';
    paintAvatar(next.avatar || '');
    initClocks();
  });
  store.onChange('categories', renderCats);
}

function bindKeys() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#search-input').focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      $('#settings-overlay').hidden = false;
    }
    if (e.key === 'Escape') {
      $('#settings-overlay').hidden = true;
      closeScModal();
    }
  });
}

boot().catch(err => {
  console.error('[KOCH BRAUZER] boot:', err);
  toast('Ошибка инициализации — смотри консоль (F12)');
});