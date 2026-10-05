/**
 * Модуль анимаций: observer для fade-in, hover-эффекты.
 */

import { $$ } from './utils.js';
import { storage } from './storage.js';

let animationsEnabled = true;

export async function initAnimations() {
  const settings = await storage.get('settings');
  animationsEnabled = settings.animations !== false;
  applyMotionPref();
}

export function applyMotionPref() {
  document.documentElement.style.setProperty(
    '--motion', animationsEnabled ? '1' : '0'
  );
  if (!animationsEnabled) {
    document.documentElement.classList.add('reduce-motion');
  } else {
    document.documentElement.classList.remove('reduce-motion');
  }
}

export function setAnimationsEnabled(enabled) {
  animationsEnabled = enabled;
  applyMotionPref();
}

/** Наблюдатель за появлением элементов */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

export function observe(selector) {
  $$(selector).forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });
}

export function refreshObserver(selector) {
  $$(selector).forEach(el => observer.observe(el));
}