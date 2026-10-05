/**
 * Цитаты дня.
 */

import { $, el } from './utils.js';

const QUOTES = [
  { text: 'Простота — высшая форма изысканности.', author: 'Леонардо да Винчи' },
  { text: 'Делай что должен, и будь что будет.', author: 'Марк Аврелий' },
  { text: 'Единственный способ делать великие дела — любить то, что ты делаешь.', author: 'Стив Джобс' },
  { text: 'Воображение важнее знаний.', author: 'Альберт Эйнштейн' },
  { text: 'Жизнь — это то, что с тобой происходит, пока ты строишь планы.', author: 'Джон Леннон' },
  { text: 'Будь изменением, которое хочешь видеть в мире.', author: 'Махатма Ганди' },
  { text: 'Время — самый ценный ресурс.', author: 'Бенджамин Франклин' },
  { text: 'Совершенство достигается не тогда, когда нечего добавить, а когда нечего убрать.', author: 'Антуан де Сент-Экзюпери' },
  { text: 'Код — это поэзия логики.', author: 'Неизвестный программист' },
  { text: 'Каждый эксперт когда-то был новичком.', author: 'Хелен Хейс' },
  { text: 'Лучший способ предсказать будущее — создать его.', author: 'Питер Друкер' },
  { text: 'Успех — это идти от неудачи к неудаче, не теряя энтузиазма.', author: 'Уинстон Черчилль' }
];

export function showRandomQuote() {
  const popup = $('#quote-popup');
  if (!popup) return;
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  $('#quote-text', popup).textContent = `«${q.text}»`;
  $('#quote-author', popup).textContent = `— ${q.author}`;
  popup.hidden = false;
}

export function nextQuote() { showRandomQuote(); }

export function hideQuote() {
  const popup = $('#quote-popup');
  if (popup) popup.hidden = true;
}