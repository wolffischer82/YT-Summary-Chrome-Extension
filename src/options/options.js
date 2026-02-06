// Save options to chrome.storage.local
const saveOptions = () => {
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.local.set(
      { geminiApiKey: apiKey },
      () => {
        const status = document.getElementById('status');
        status.style.display = 'block';
        setTimeout(() => {
          status.style.display = 'none';
        }, 2000);
      }
    );
  };
  
  // Restore options from chrome.storage.local
  const restoreOptions = () => {
    chrome.storage.local.get(
      { geminiApiKey: '' }, // Default value
      (items) => {
        document.getElementById('apiKey').value = items.geminiApiKey;
      }
    );
  };
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);
