const api = typeof browser !== 'undefined' ? browser : chrome;

const KOCH_NEW_TAB_URL = api.runtime.getURL('newtab.html');

const STARTUP_PAGE_URLS = new Set([
  'about:home',
  'about:newtab',
  'about:welcome',
  'about:blank'
]);

const startupCandidates = new Map();

const STARTUP_BLANK_DELAY = 1200;

function isStartupPageUrl(url) {
  if (!url) return false;

  if (url === KOCH_NEW_TAB_URL) {
    return true;
  }

  return STARTUP_PAGE_URLS.has(url);
}

function isExternalOrRealNavigation(url) {
  if (!url) return false;

  if (url === KOCH_NEW_TAB_URL) {
    return false;
  }

  if (isStartupPageUrl(url)) {
    return false;
  }

  return true;
}

async function replaceStartupCandidate(tabId) {
  const candidate = startupCandidates.get(tabId);

  if (!candidate) {
    return;
  }

  startupCandidates.delete(tabId);

  try {
    const tab = await api.tabs.get(tabId);

    if (!tab || !tab.id) {
      return;
    }

    const currentUrl = tab.url || '';

    if (isExternalOrRealNavigation(currentUrl)) {
      console.log(
        '[KOCH] Startup candidate became real navigation:',
        currentUrl
      );
      return;
    }

    if (currentUrl === KOCH_NEW_TAB_URL) {
      return;
    }

    if (!isStartupPageUrl(currentUrl)) {
      console.log(
        '[KOCH] Startup candidate rejected:',
        currentUrl
      );
      return;
    }

    console.log(
      '[KOCH] Opening KOCH startup page in tab:',
      tabId,
      currentUrl
    );

    await api.tabs.update(tabId, {
      url: KOCH_NEW_TAB_URL
    });
  } catch (err) {
    console.error(
      '[KOCH] Failed to replace startup tab:',
      err
    );
  }
}

function registerStartupCandidate(tab) {
  if (!tab || !tab.id) {
    return;
  }

  const url = tab.url || '';

  if (isExternalOrRealNavigation(url)) {
    return;
  }

  if (url === KOCH_NEW_TAB_URL) {
    return;
  }

  if (!isStartupPageUrl(url)) {
    return;
  }

  const delay = url === 'about:blank'
  ? STARTUP_BLANK_DELAY
  : 0;

  startupCandidates.set(tab.id, {
    initialUrl: url,
    timer: null
  });

  const candidate = startupCandidates.get(tab.id);

  candidate.timer = setTimeout(() => {
    replaceStartupCandidate(tab.id);
  }, delay);
}

if (api.tabs && api.tabs.onUpdated) {
  api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const candidate = startupCandidates.get(tabId);

    if (!candidate) {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(changeInfo, 'url')) {
      return;
    }

    const newUrl = changeInfo.url || '';

    if (isExternalOrRealNavigation(newUrl)) {
      const current = startupCandidates.get(tabId);

      if (current?.timer) {
        clearTimeout(current.timer);
      }

      startupCandidates.delete(tabId);

      console.log(
        '[KOCH] External navigation detected, leaving tab untouched:',
        newUrl
      );

      return;
    }

    if (isStartupPageUrl(newUrl)) {
      candidate.initialUrl = newUrl;
    }
  });

  api.tabs.onRemoved.addListener((tabId) => {
    const candidate = startupCandidates.get(tabId);

    if (candidate?.timer) {
      clearTimeout(candidate.timer);
    }

    startupCandidates.delete(tabId);
  });
}

api.runtime.onStartup.addListener(async () => {
  console.log('[KOCH] Browser startup detected');

  try {
    const windows = await api.windows.getAll({
      populate: true,
      windowTypes: ['normal']
    });

    if (!windows || windows.length === 0) {
      console.log('[KOCH] No normal browser windows found');
      return;
    }

    const win =
    windows.find(window => window.focused) ||
    windows[0];

    if (!win.tabs || win.tabs.length === 0) {
      console.log('[KOCH] No tabs found at startup');
      return;
    }

    console.log(
      '[KOCH] Startup tabs:',
      win.tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        active: tab.active
      }))
    );

    for (const tab of win.tabs) {
      const url = tab.url || '';

      if (isExternalOrRealNavigation(url)) {
        console.log(
          '[KOCH] Real navigation found at startup, leaving untouched:',
          url
        );
        continue;
      }

      registerStartupCandidate(tab);
    }
  } catch (err) {
    console.error('[KOCH] Startup error:', err);
  }
});

api.runtime.onInstalled.addListener(({ reason }) => {
  console.log('[KOCH] onInstalled:', reason);
});

if (api.action && api.action.onClicked) {
  api.action.onClicked.addListener(() => {
    api.tabs.create({});
  });
}
