const api = typeof browser !== 'undefined' ? browser : chrome;

api.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') console.log('KOCH BRAUZER установлен');
});

/* Открывать KOCH BRAUZER при запуске Firefox */
api.runtime.onStartup.addListener(() => {
  api.tabs.create({ url: api.runtime.getURL('newtab.html') });
});

if (api.action && api.action.onClicked) {
  api.action.onClicked.addListener(() => api.tabs.create({}));
}
