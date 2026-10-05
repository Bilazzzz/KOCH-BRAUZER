/**
 * Виджеты: часы, погода, заметки, задачи, калькулятор.
 */

import { $, el, fmtDate, fmtTime, toast } from './utils.js';
import { storage } from './storage.js';

/* ---------- Часы ---------- */
export function startClock() {
  const timeEl = $('.clock-time');
  const dateEl = $('.clock-date');
  if (!timeEl || !dateEl) return;

  const tick = () => {
    const now = new Date();
    timeEl.textContent = fmtTime(now);
    dateEl.textContent = fmtDate(now);
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- Погода (wttr.in, без API-ключа) ---------- */
export async function loadWeather() {
  const settings = await storage.get('settings');
  if (!settings.weather?.enabled) return;

  const city = settings.weather.city || 'Moscow';
  const widget = $('#weather-widget');
  if (!widget) return;
  widget.hidden = false;

  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const cur = data.current_condition?.[0];
    if (!cur) return;

    const code = parseInt(cur.weatherCode);
    const icon = weatherCodeToIcon(code, cur.weatherDesc?.[0]?.value || '');
    $('.weather-icon', widget).textContent = icon;
    $('.weather-temp', widget).textContent = `${cur.temp_C}°`;
  } catch (e) {
    console.warn('Weather error:', e);
  }
}

function weatherCodeToIcon(code) {
  if ([113].includes(code)) return '☀️';
  if ([116].includes(code)) return '⛅';
  if ([119, 122].includes(code)) return '☁️';
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359].includes(code)) return '🌧';
  if ([200, 386, 389, 392, 395].includes(code)) return '⛈';
  if ([179, 182, 185, 227, 230, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(code)) return '❄️';
  if ([143, 248, 260].includes(code)) return '🌫';
  return '☁️';
}

/* ---------- Заметки ---------- */
export async function initNotes() {
  const area = $('#notes-area');
  if (!area) return;
  area.value = await storage.get('notes') || '';
  area.addEventListener('input', () => storage.set('notes', area.value));
}

/* ---------- Задачи ---------- */
export async function initTodo() {
  const list = $('#todo-list');
  const form = $('#todo-form');
  const input = $('#todo-input');
  if (!list || !form || !input) return;

  let todos = await storage.get('todos') || [];

  const save = () => storage.set('todos', todos);

  const render = () => {
    list.innerHTML = '';
    todos.forEach((t, i) => {
      const li = el('li', { class: `todo-item ${t.done ? 'done' : ''}` },
        el('input', { type: 'checkbox', checked: t.done ? 'checked' : false,
          onchange: () => { todos[i].done = !todos[i].done; save(); render(); }
        }),
        el('span', { class: 'todo-text' }, t.text),
        el('button', { onclick: () => { todos.splice(i, 1); save(); render(); } }, '✕')
      );
      list.appendChild(li);
    });
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    todos.push({ id: Date.now(), text, done: false });
    input.value = '';
    save(); render();
  });

  render();
}

/* ---------- Калькулятор ---------- */
export function initCalc() {
  const display = $('#calc-display');
  const grid = $('#calc-grid');
  if (!display || !grid) return;

  const buttons = [
    'C', '±', '%', '÷',
    '7','8','9','×',
    '4','5','6','−',
    '1','2','3','+',
    '0','.', '='
  ];

  let expr = '';

  const render = () => { display.textContent = expr || '0'; };

  grid.innerHTML = '';
  buttons.forEach(b => {
    const cls = ['÷','×','−','+','%','±','C'].includes(b) ? 'op' : (b === '=' ? 'eq' : '');
    const btn = el('button', { class: cls, onclick: () => press(b) }, b);
    grid.appendChild(btn);
  });

  /** Простой безопасный парсер математических выражений (без eval/Function). */
  function safeEval(expr) {
    const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    // Разрешаем только цифры, операторы, скобки, точки, пробелы
    if (!/^[0-9+\-*/().\s]+$/.test(clean)) return NaN;

    // Рекурсивный парсер: expr → term (('+'|'-') term)*
    //                     term → factor (('*'|'/') factor)*
    //                     factor → ('+'|'-')? number | '(' expr ')'
    //                     number → digits ('.' digits)?
    let pos = 0;

    function skipSpaces() {
      while (pos < clean.length && /\s/.test(clean[pos])) pos++;
    }

    function parseExpr() {
      let left = parseTerm();
      while (true) {
        skipSpaces();
        const ch = clean[pos];
        if (ch === '+' || ch === '-') {
          pos++;
          const right = parseTerm();
          left = ch === '+' ? left + right : left - right;
        } else break;
      }
      return left;
    }

    function parseTerm() {
      let left = parseFactor();
      while (true) {
        skipSpaces();
        const ch = clean[pos];
        if (ch === '*' || ch === '/') {
          pos++;
          const right = parseFactor();
          if (ch === '*') left *= right;
          else left = right === 0 ? NaN : left / right;
        } else break;
      }
      return left;
    }

    function parseFactor() {
      skipSpaces();
      let sign = 1;
      if (clean[pos] === '+') pos++;
      else if (clean[pos] === '-') { sign = -1; pos++; }

      skipSpaces();
      if (clean[pos] === '(') {
        pos++;
        const val = parseExpr();
        skipSpaces();
        if (clean[pos] !== ')') return NaN;
        pos++;
        return sign * val;
      }

      let numStr = '';
      while (pos < clean.length && /[0-9.]/.test(clean[pos])) {
        numStr += clean[pos++];
      }
      if (!numStr) return NaN;
      const val = parseFloat(numStr);
      if (isNaN(val)) return NaN;
      return sign * val;
    }

    skipSpaces();
    const result = parseExpr();
    skipSpaces();
    if (pos !== clean.length) return NaN;
    return result;
  }

  function press(b) {
    if (b === 'C') { expr = ''; }
    else if (b === '=') {
      const val = safeEval(expr);
      expr = isNaN(val) ? 'Ошибка' : String(val);
    }
    else if (b === '±') {
      expr = expr.startsWith('-') ? expr.slice(1) : `-${expr}`;
    }
    else { expr += b; }
    render();
  }

  render();
}