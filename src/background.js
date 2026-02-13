// Open the side panel by clicking the action icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'OPEN_SIDE_PANEL') {
        if (sender.tab && sender.tab.id) {
            chrome.sidePanel.open({ tabId: sender.tab.id });
        }
    }
});

// Update Side Panel when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes("youtube.com/watch")) {
        // Notify side panel to update
        chrome.runtime.sendMessage({
            type: "UPDATE_SIDE_PANEL",
            url: tab.url,
            title: tab.title
        }).catch(() => {
            // Side panel might be closed, ignore error
        });
    }
});

// Update Side Panel when tab URL changes (e.g. navigation within YouTube)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("youtube.com/watch")) {
        chrome.runtime.sendMessage({
            type: "UPDATE_SIDE_PANEL",
            url: tab.url,
            title: tab.title
        }).catch(() => {
            // Side panel might be closed
        });
    }
});
