document.addEventListener('DOMContentLoaded', () => {
    // Check for saved state or wait for message
    chrome.storage.local.get(['lastSummary', 'lastVideoUrl'], (result) => {
        if (result.lastSummary) {
            displaySummary(result.lastSummary);
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SUMMARIZE_VIDEO') {
        const url = request.videoUrl;
        const title = request.videoTitle || "Unknown Video";
        const transcript = request.transcript || null;
        generateSummary(url, title, transcript);
    }
});

async function generateSummary(videoUrl, videoTitle, transcript) {
    const contentDiv = document.getElementById('content');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');

    // Reset UI
    contentDiv.innerHTML = '';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'flex';

    try {
        if (!transcript) {
            throw new Error('Could not extract transcript for this video. The video may not have captions available.');
        }

        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('Please set your Gemini API Key in the extension options.');
        }

        const { summary, promptUsed } = await callGeminiApi(apiKey, videoUrl, videoTitle, transcript);

        // Save result
        chrome.storage.local.set({
            lastSummary: summary,
            lastVideoUrl: videoUrl
        });

        displaySummary(summary, videoTitle, videoUrl, promptUsed);

    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';

        // Auto-debug: If model not found, list available models to help user/developer
        if (err.message.includes("not found") || err.message.includes("404") || err.message.includes("supported")) {
            console.log("Attempting to list models...");
            const apiKey = await getApiKey();
            if (apiKey) {
                const models = await listAvailableModels(apiKey);
                const debugMsg = document.createElement('div');
                debugMsg.style.marginTop = "10px";
                debugMsg.style.fontSize = "12px";
                debugMsg.style.whiteSpace = "pre-wrap";
                debugMsg.textContent = "Available Models:\n" + models.join("\n");
                errorDiv.appendChild(debugMsg);
            }
        }
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey);
        });
    });
}

async function callGeminiApi(apiKey, videoUrl, videoTitle, transcript) {
    const modelName = 'gemini-3-flash-preview';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `You are a helpful assistant. Provide a detailed summary of the following YouTube video based on its transcript.\n\n` +
        `Video Title: ${videoTitle || videoUrl}\n` +
        `Transcript:\n${transcript}\n\n` +
        `Summary:`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch summary from Gemini.');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('Empty response from Gemini.');
    }

    return { summary: text, promptUsed: prompt };
}

function displaySummary(text, videoTitle, videoUrl, promptUsed) {
    const contentDiv = document.getElementById('content');

    // Debug Info Block
    const debugHtml = `
        <div style="background:#f0f0f0; padding:10px; margin-bottom:15px; border-radius:5px; font-size:12px; color:#333;">
            <strong>Title:</strong> ${videoTitle || "N/A"}
        </div>
    `;

    contentDiv.innerHTML = debugHtml + formatMarkdown(text);
    contentDiv.className = 'summary-content';
}

// Simple Markdown Formatter
function formatMarkdown(text) {
    let html = text
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // Lists
        .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
        // Newlines to <br> (simplified)
        .replace(/\n/gim, '<br>');

    return html;
}

// Debug helper to find the correct model name
async function listAvailableModels(apiKey) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        return data.models ? data.models.map(m => m.name) : ["No models found"];
    } catch (e) {
        return ["Error listing models: " + e.message];
    }
}

if (typeof module !== 'undefined') {
    module.exports = { formatMarkdown };
}
