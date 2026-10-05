const api = typeof browser !== 'undefined' ? browser : chrome;

api.runtime.onInstalled.addListener(({ reason }) => {
  console.log('[KOCH] onInstalled:', reason);
});

/* При запуске Firefox: заменяем первую вкладку окна на KOCH.
 *  Если там уже KOCH (через override новой вкладки) — ничего не делаем.
 *  Вкладку НЕ создаём, работает с уже открытой. */
api.runtime.onStartup.addListener(async () => {
  try {
    const myUrl = api.runtime.getURL('newtab.html');
    const wins = await api.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const win = wins && wins[0];
    if (!win || !win.tabs || win.tabs.length === 0) return;

    const first = win.tabs.find(t => t.active) || win.tabs[0];
    if (!first || !first.id) return;

    /* Если URL уже KOCH — ничего не делаем */
    if (first.url && first.url.startsWith(myUrl)) return;

    /* Иначе заменяем содержимое вкладки (не создаём новую) */
    await api.tabs.update(first.id, { url: myUrl });
  } catch (err) {
    console.error('[KOCH] onStartup error:', err);
  }
});

if (api.action && api.action.onClicked) {
  api.action.onClicked.addListener(() => api.tabs.create({}));
}
