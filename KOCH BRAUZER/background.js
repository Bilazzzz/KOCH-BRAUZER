const api = typeof browser !== 'undefined' ? browser : chrome;

api.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') console.log('KOCH BRAUZER установлен');
});

if (api.action && api.action.onClicked) {
  api.action.onClicked.addListener(() => api.tabs.create({}));
}
