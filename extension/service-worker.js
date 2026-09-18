const OFFSCREEN_PATH = 'offscreen.html';

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url]
  });
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Capture tab audio for Ready Transpose'
    });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await ensureOffscreen();
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });
    await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      target: 'offscreen',
      streamId
    });
  } catch (error) {
    console.error('Ready Transpose capture failed', error);
  }
});
