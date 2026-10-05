/** Темы + фон. Защита от цикла записи в storage. */

import { store } from './storage.js';

export const THEMES = {
  rose:   'Розовая',
  purple: 'Фиолетовая',
  ocean:  'Океан',
  green:  'Изумруд',
  dark:   'Тёмная',
  light:  'Светлая'
};

let appliedTheme = null;
let appliedBgUrl = null;

export async function applyTheme(id, persist = true) {
  if (!THEMES[id]) id = 'rose';
  if (id === appliedTheme && !persist) return;   // ← защита от бесконечного цикла
  appliedTheme = id;
  document.body.dataset.theme = id;
  if (persist) {
    await store.update('settings', s => ({ ...s, theme: id }));
  }
}

export async function applyBackground() {
  const s = await store.get('settings');
  const bg = s.bg || { type: 'none', url: '' };
  const video = document.getElementById('bg-video');
  const image = document.getElementById('bg-image');
  const orbs  = document.getElementById('bg-orbs');
  if (!video || !image || !orbs) return;

  const url = (bg.type !== 'none' && bg.url) ? bg.url : null;

  if (bg.type === 'video' && url) {
    image.hidden = true;
    orbs.hidden = true;
    video.hidden = false;
    if (appliedBgUrl !== url) {
      appliedBgUrl = url;
      video.src = url;
      video.play().catch(() => {});
    }
  } else if (bg.type === 'image' && url) {
    video.hidden = true; video.pause();
    orbs.hidden = true;
    image.hidden = false;
    image.style.backgroundImage = `url("${url}")`;
    appliedBgUrl = url;
  } else {
    video.hidden = true; video.pause();
    image.hidden = true;
    orbs.hidden = false;
    appliedBgUrl = null;
  }
}
