const api = typeof browser !== 'undefined' ? browser : chrome;

const KOCH_NEW_TAB_URL = api.runtime.getURL('newtab.html');
const STARTUP_PAGE_URLS = new Set([
  'about:home',
  'about:newtab',
  'about:welcome',
  'about:blank',
  'chrome://newtab/',
  'chrome://new-tab-page/',
  'edge://newtab/',
  'brave://newtab/',
  'vivaldi://newtab/'
]);
const STARTUP_BLANK_DELAY = 1200;

const startupCandidates = new Map();
let listening = false;

const isStartupPageUrl = url => url === KOCH_NEW_TAB_URL || STARTUP_PAGE_URLS.has(url);
const isExternalOrRealNavigation = url => !!url && !isStartupPageUrl(url);

function isNavigationInFlight(tab) {
  if (tab.pendingUrl && isExternalOrRealNavigation(tab.pendingUrl)) return true;
  return tab.status === 'loading';
}

/* Слушатели вкладок нужны только на время стартовой проверки. Если держать их постоянно,
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

  // Начало загрузки на about:blank = идёт реальная навигация (внешняя ссылка ещё не зафиксировала URL).
  if (
    changeInfo.status === 'loading' &&
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
  if (isStartupPageUrl(newUrl)) candidate.initialUrl = newUrl;
}

async function replaceStartupCandidate(tabId) {
  if (!startupCandidates.delete(tabId)) return;

  try {
    const tab = await api.tabs.get(tabId);
    const url = tab?.url || '';

    // Заменяем только вкладку, которая всё ещё стоит на стартовой странице браузера.
    if (!STARTUP_PAGE_URLS.has(url)) return;

    // about:blank во время запуска часто означает, что внешняя ссылка (например, из клиента Epic Games)
    // ещё загружается: tab.url остаётся about:blank, пока навигация не зафиксирована.
    // Такую вкладку нельзя подменять страницей расширения.
    if (url === 'about:blank' && isNavigationInFlight(tab)) return;

    await api.tabs.update(tabId, { url: KOCH_NEW_TAB_URL });
  } catch (err) {
    console.error('[KOCH] Failed to replace startup tab:', err);
  } finally {
    if (!startupCandidates.size) stopListening();
  }
}

function registerStartupCandidate(tab) {
  if (!tab || typeof tab.id !== 'number' || tab.pinned || !STARTUP_PAGE_URLS.has(tab.url || '')) return;

  const prev = startupCandidates.get(tab.id);
  if (prev) clearTimeout(prev.timer);

  const url = tab.url;
  startupCandidates.set(tab.id, {
    initialUrl: url,
    timer: setTimeout(() => replaceStartupCandidate(tab.id), url === 'about:blank' ? STARTUP_BLANK_DELAY : 0)
  });
}

api.runtime.onStartup.addListener(async () => {
  startListening();

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
