/* ============================================
   VIBEPALETTE - BACKGROUND SERVICE WORKER
   Handles screenshot capture on extension click
   ============================================ */

/**
 * Captures the visible area of the current tab.
 * Called from the popup to get a screenshot.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureScreen') {
        // Capture the visible tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error('Screenshot error:', chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl: dataUrl });
            }
        });

        // Return true to indicate we'll respond asynchronously
        return true;
    }
});
