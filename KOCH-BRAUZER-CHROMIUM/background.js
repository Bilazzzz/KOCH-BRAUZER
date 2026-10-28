const api = typeof browser !== 'undefined' ? browser : chrome;

const KOCH_NEW_TAB_URL = api.runtime.getURL('newtab.html');
const STARTUP_PAGE_URLS = new Set([
  'about:home',
  'about:newtab',
  'about:welcome',
  'about:blank',
  'chrome://newtab',
  'chrome://newtab/',
  'chrome://new-tab-page',
  'chrome://new-tab-page/',
  'edge://newtab',
  'edge://newtab/',
  'brave://newtab',
  'brave://newtab/',
  'vivaldi://newtab',
  'vivaldi://newtab/',
  'opera://startpage',
  'opera://startpage/'
]);
const STARTUP_BLANK_DELAY = 1200;

const startupCandidates = new Map();
let listening = false;

const isKochNewTabUrl = url => typeof url === 'string' && url.startsWith(KOCH_NEW_TAB_URL);
const isStartupPageUrl = url => isKochNewTabUrl(url) || STARTUP_PAGE_URLS.has(url);
const isExternalOrRealNavigation = url => !!url && !isStartupPageUrl(url);

function isNavigationInFlight(tab) {
  if (tab.pendingUrl && isExternalOrRealNavigation(tab.pendingUrl)) return true;
  return tab.status === 'loading';
}

/* Слушатели вкладок нужны только на время стартовой проверки about:blank. Если держать их постоянно,
   фоновый скрипт просыпается при каждом обновлении любой вкладки браузера. */
function startListening() {
  if (listening || !api.tabs?.onUpdated) return;
  listening = true;
  api.tabs.onUpdated.addListener(onTabUpdated);
  api.tabs.onRemoved.addListener(dropStartupCandidate);
}

function stopListening() {
  if (!listening) return;
  listening = false;
  api.tabs.onUpdated.removeListener(onTabUpdated);
  api.tabs.onRemoved.removeListener(dropStartupCandidate);
}

function dropStartupCandidate(tabId) {
  const candidate = startupCandidates.get(tabId);
  if (!candidate) return;
  clearTimeout(candidate.timer);
  startupCandidates.delete(tabId);
  if (!startupCandidates.size) stopListening();
}

function onTabUpdated(tabId, changeInfo, tab) {
  const candidate = startupCandidates.get(tabId);
  if (!candidate) return;

  const pending = tab?.pendingUrl || '';
  if (tab?.pinned || tab?.discarded || changeInfo.pinned || changeInfo.discarded || isExternalOrRealNavigation(pending)) {
    dropStartupCandidate(tabId);
    return;
  }

  // Начало загрузки на about:blank без смены URL на стартовую страницу = идёт реальная навигация.
  if (
    changeInfo.status === 'loading' &&
    !Object.prototype.hasOwnProperty.call(changeInfo, 'url') &&
    candidate.initialUrl === 'about:blank' &&
    (!tab || !tab.url || tab.url === 'about:blank')
  ) {
    dropStartupCandidate(tabId);
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(changeInfo, 'url')) return;

  const newUrl = changeInfo.url || '';
  if (isExternalOrRealNavigation(newUrl)) {
    dropStartupCandidate(tabId);
    return;
  }
  if (isStartupPageUrl(newUrl)) {
    if (isKochNewTabUrl(newUrl)) {
      dropStartupCandidate(tabId);
      return;
    }
    candidate.initialUrl = newUrl;
    if (newUrl !== 'about:blank') {
      clearTimeout(candidate.timer);
      replaceStartupCandidate(tabId, true);
    }
  }
}

async function replaceStartupCandidate(tabId, immediate = false) {
  if (!startupCandidates.delete(tabId)) return;

  try {
    if (!immediate) {
      const tab = await api.tabs.get(tabId);
      if (tab?.pinned || tab?.discarded || tab?.openerTabId != null) return;
      const pending = tab?.pendingUrl || '';
      const current = tab?.url || '';
      const url = pending || current;

      // Не трогаем вкладку, если уже начался переход на внешний адрес или она ушла со стартовой страницы.
      if (isExternalOrRealNavigation(pending) || isExternalOrRealNavigation(current)) return;
      if (!STARTUP_PAGE_URLS.has(url)) return;

      // about:blank во время запуска часто означает, что внешняя ссылка ещё загружается.
      if (url === 'about:blank' && isNavigationInFlight(tab)) return;
    }

    await api.tabs.update(tabId, { url: KOCH_NEW_TAB_URL });
  } catch {
    // Вкладка могла быть закрыта пользователем до срабатывания таймера
  } finally {
    if (!startupCandidates.size) stopListening();
  }
}

function registerStartupCandidate(tab) {
  const pending = tab?.pendingUrl || '';
  if (isExternalOrRealNavigation(pending)) return;
  const url = pending || tab?.url || '';
  if (!tab || typeof tab.id !== 'number' || tab.pinned || tab.discarded || tab.openerTabId != null || !STARTUP_PAGE_URLS.has(url)) return;

  const prev = startupCandidates.get(tab.id);
  if (prev) {
    clearTimeout(prev.timer);
    startupCandidates.delete(tab.id);
  }

  if (url !== 'about:blank') {
    try { Promise.resolve(api.tabs.update(tab.id, { url: KOCH_NEW_TAB_URL })).catch(() => {}); } catch {}
    return;
  }

  startListening();
  startupCandidates.set(tab.id, {
    initialUrl: url,
    timer: setTimeout(() => replaceStartupCandidate(tab.id, false), STARTUP_BLANK_DELAY)
  });
}

api.runtime.onStartup.addListener(async () => {
  try {
    const windows = await api.windows.getAll({ populate: true, windowTypes: ['normal'] });
    for (const win of windows || []) {
      for (const tab of win?.tabs || []) registerStartupCandidate(tab);
    }
  } catch (err) {
    console.error('[KOCH] Startup error:', err);
  } finally {
    if (!startupCandidates.size) stopListening();
  }
});
