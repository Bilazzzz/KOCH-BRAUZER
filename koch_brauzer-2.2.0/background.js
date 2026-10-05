/** Service Worker. */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') console.log('KOCH BRAUZER установлен 🌸');
});

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(() => chrome.tabs.create({}));
}
