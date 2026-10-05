/**
 * Локализация: RU/EN. Поддержка data-i18n атрибутов.
 */

const STRINGS = {
  ru: {
    search: 'Искать в',
    clearHistory: 'Очистить историю',
    delete: 'Удалить',
    edit: 'Редактировать',
    add: 'Добавить',
    save: 'Сохранить',
    cancel: 'Отмена',
    settings: 'Настройки',
    shortcuts: 'Ярлыки',
    categories: 'Категории',
    themes: 'Темы',
    searchHistory: 'История поиска',
    general: 'Общие',
    animations: 'Анимации',
    importExport: 'Импорт/Экспорт',
    reset: 'Сброс',
    notes: 'Заметки',
    todo: 'Список задач',
    calculator: 'Калькулятор',
    quote: 'Цитата дня',
    language: 'Язык',
    confirmReset: 'Вы действительно хотите сбросить все настройки?',
    noHistory: 'История пуста',
    addShortcut: 'Добавить ярлык',
    editShortcut: 'Редактировать ярлык'
  },
  en: {
    search: 'Search in',
    clearHistory: 'Clear history',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    settings: 'Settings',
    shortcuts: 'Shortcuts',
    categories: 'Categories',
    themes: 'Themes',
    searchHistory: 'Search history',
    general: 'General',
    animations: 'Animations',
    importExport: 'Import/Export',
    reset: 'Reset',
    notes: 'Notes',
    todo: 'To-Do',
    calculator: 'Calculator',
    quote: 'Quote of the day',
    language: 'Language',
    confirmReset: 'Are you sure you want to reset all settings?',
    noHistory: 'History is empty',
    addShortcut: 'Add shortcut',
    editShortcut: 'Edit shortcut'
  }
};

let currentLang = 'ru';

export function setLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (STRINGS[lang][key]) el.textContent = STRINGS[lang][key];
  });
}

export function t(key) {
  return STRINGS[currentLang]?.[key] ?? STRINGS['ru'][key] ?? key;
}

export function getLang() { return currentLang; }

export { STRINGS };