# Ready Transpose Audio Bridge

Chrome extension proof of concept for capturing the active tab's audio with chrome.tabCapture.

## Test

1. Open Chrome and go to chrome://extensions.
2. Enable Developer mode.
3. Click Load unpacked and select the repository's extension folder.
4. Open a YouTube tab.
5. Click the Ready Transpose Audio Bridge extension icon.
6. The tab audio should continue through the extension AudioContext.

This POC intentionally has no pitch processing yet. It verifies that Chrome tab capture can cleanly capture and reroute tab audio.

The extension uses a Manifest V3 service worker plus an offscreen document, matching Chrome's recommended architecture for persistent tab audio capture.
