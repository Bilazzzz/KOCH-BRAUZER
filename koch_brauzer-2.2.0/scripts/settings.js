/** Настройки. */

import { $, toast, debounce, readFileAsDataURL } from './utils.js';
import { store } from './storage.js';
import { applyBackground } from './theme.js';
import { initClocks } from './clocks.js';

// Нет искусственного лимита размера — Firefox WebExtension хранит base64
// в storage.local без ограничений, совместимых с Chromium.

export function bindSettings() {
  $('#settings-btn').addEventListener('click', openSettings);

  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; });
  });
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => {
      const t = document.getElementById(b.getAttribute('data-close'));
      if (t) t.hidden = true;
    });
  });

  $('#set-subtitle').addEventListener('input', debounce((e) => {
    store.update('settings', s => ({ ...s, subtitle: e.target.value }));
    $('#subtitle').textContent = e.target.value;
  }, 300));

  const cityHandler = (idx) => debounce((e) => {
    store.update('settings', s => {
      const cities = (s.cities || []).slice();
      cities[idx] = e.target.value;
      return Object.assign({}, s, { cities });
    });
    initClocks();
  }, 500);
  $('#set-city-a').addEventListener('input', cityHandler(0));
  $('#set-city-b').addEventListener('input', cityHandler(1));

  $('#set-avatar').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const url = await readFileAsDataURL(f);
      await store.update('settings', s => ({ ...s, avatar: url }));
      paintAvatar(url);
      toast('Аватар обновлён');
    } catch (err) { toast('Ошибка чтения файла'); }
  });
  $('#reset-avatar').addEventListener('click', async () => {
    await store.update('settings', s => ({ ...s, avatar: '' }));
    paintAvatar('');
    toast('Аватар сброшен');
  });

  $('#set-bg-type').addEventListener('change', async (e) => {
    await store.update('settings', s => ({ ...s, bg: { type: e.target.value, url: (s.bg && s.bg.url) || '' } }));
    applyBackground();
  });
  $('#set-bg-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const url = await readFileAsDataURL(f);
      const type = f.type.indexOf('video') === 0 ? 'video' : 'image';
      await store.update('settings', s => ({ ...s, bg: { type, url } }));
      $('#set-bg-type').value = type;
      applyBackground();
      toast('Фон обновлён');
    } catch (err) {
      console.error('[KOCH settings] failed to read file:', err);
      toast('Ошибка чтения файла — проверьте консоль (F12)');
    }
  });
  $('#set-bg-url').addEventListener('change', async (e) => {
    const url = e.target.value.trim();
    await store.update('settings', s => ({ ...s, bg: { type: s.bg.type, url } }));
    applyBackground();
    toast('Фон обновлён');
  });

  $('#export-btn').addEventListener('click', async () => {
    const blob = new Blob([await store.exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'koch-brauzer-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Экспортировано');
  });
  $('#import-btn').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await store.importAll(await f.text());
      toast('Импортировано, перезагрузка…');
      setTimeout(() => location.reload(), 800);
    } catch (err) { toast('Ошибка импорта'); }
  });
  $('#reset-btn').addEventListener('click', async () => {
    if (confirm('Сбросить все настройки и данные?')) {
      await store.reset();
      location.reload();
    }
  });
}

export async function openSettings() {
  const s = await store.get('settings');
  $('#set-subtitle').value = s.subtitle || '';
  $('#set-city-a').value = (s.cities && s.cities[0]) || '';
  $('#set-city-b').value = (s.cities && s.cities[1]) || '';
  $('#set-bg-type').value = (s.bg && s.bg.type) || 'none';
  $('#set-bg-url').value = (s.bg && s.bg.url && s.bg.url.indexOf('data:') !== 0) ? s.bg.url : '';
  $('#settings-overlay').hidden = false;
}

export function paintAvatar(url) {
  const img = document.getElementById('avatar-img');
  const fb  = document.getElementById('avatar-fallback');
  if (!img || !fb) return;
  if (url) { img.src = url; img.hidden = false; fb.hidden = true; }
  else { img.hidden = true; fb.hidden = false; }
}
