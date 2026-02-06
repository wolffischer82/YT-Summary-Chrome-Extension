// Open the side panel by clicking the action icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'OPEN_SIDE_PANEL') {
        // In some cases we might need to handle opening here, 
        // but often the user interaction (click) in content script 
        // needs to coordinate with sidePanel.open if permitted.
        // However, opening side panel PROGRAMMATICALLY from content script is restricted.
        // It generally requires a user gesture in the extension context (like clicking browser action).

        // Strategy: The button in the content script can't directly open the side panel 
        // unless we use `chrome.sidePanel.open` which requires a user gesture in the BACKGROUND context (not content script).
        // BUT, chrome.sidePanel.open({tabId, windowId}) is available in Chrome 114+ from background.

        if (sender.tab && sender.tab.id) {
            chrome.sidePanel.open({ tabId: sender.tab.id });
            // We also forward the video URL to the side panel via storage or runtime message
            // Since the sidebar might not be open yet, we can save it to storage
            // and the sidebar checks storage on load, OR we send a message.
            // Let's do both or send message after a slight delay.
        }
    }
});
