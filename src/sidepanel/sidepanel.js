document.addEventListener('DOMContentLoaded', async () => {
    // Check for saved state (last video viewed)
    // We still use chrome.storage.local to know *which* video was last active, 
    // but the data for that video comes from DB.

    // Note: In a side panel, we might want to check the current tab instead of "last active".
    // But for now, let's keep the "restore last state" behavior if possible, or just wait for user action.

    chrome.storage.local.get(['lastVideoId'], async (result) => {
        if (result.lastVideoId) {
            try {
                const data = await window.ytStorage.getVideoData(result.lastVideoId);
                if (data && data.summary) {
                    displaySummary(data.summary, data.title, data.url, null); // promptUsed not strictly needed to restore

                    if (data.transcript) {
                        document.getElementById('qa-section').style.display = 'flex';
                        // Store in global or closure for Q&A usage
                        window.currentVideoContext = data;

                        if (data.chatHistory) {
                            clearChatUI();
                            data.chatHistory.forEach(msg => appendChatMessage(msg.role, msg.text));
                        }
                    }
                }
            } catch (e) {
                console.error("Error restoring state:", e);
            }
        }
    });

    document.getElementById('ask-button').addEventListener('click', handleAskQuestion);
    document.getElementById('regenerate-btn').addEventListener('click', () => handleRegenerate());
    document.getElementById('clear-chat-header-btn').addEventListener('click', clearChat);

    // Resizer Logic
    const handle = document.getElementById('resize-handle');
    const qaSection = document.getElementById('qa-section');
    const scrollableContent = document.getElementById('scrollable-content');

    let isResizing = false;
    let lastDownY = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastDownY = e.clientY;
        document.body.style.cursor = 'row-resize';
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerHeight = document.querySelector('.container').clientHeight;
        const headerHeight = document.querySelector('.header').clientHeight; // Fixed header
        // Calculate new height for QA section
        // Mouse moving DOWN increases scrollable area, decreases QA
        // Mouse moving UP decreases scrollable area, increases QA

        // Let's use flex-basis logic or simple height calculation. 
        // We want to set height of QA section.
        // Calculate height of fixed bottom elements
        // No longer need to subtract inputArea/separator independently as they are part of qaSection
        // BUT we need to ensure qaSection height accounts for its content.

        // New Logic:
        // qaSection (Chat Pane) height = Distance from bottom - Container Padding.
        // It contains History (flex) + Separator + Input.

        const containerRect = document.querySelector('.container').getBoundingClientRect();
        // e.clientY is relative to viewport.
        const distanceFromBottom = containerRect.bottom - e.clientY;

        // Container padding bottom
        const containerStyle = window.getComputedStyle(document.querySelector('.container'));
        const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;

        const effectiveHeight = distanceFromBottom - paddingBottom;

        // Constraints
        // Header height ~30px? Input ~50px? Safe min height ~150px.
        const minQaHeight = 150;
        const maxQaHeight = containerHeight - headerHeight - 100;

        if (effectiveHeight > minQaHeight && effectiveHeight < maxQaHeight) {
            qaSection.style.height = `${effectiveHeight}px`;
            qaSection.style.removeProperty('flex');
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
});

async function handleRegenerate() {
    const context = window.currentVideoContext;
    if (context) {
        // If we have context, use it to start regeneration
        await generateSummary(context.url, context.title, context.transcript, true); // true = forceRefresh
    } else {
        // Fallback if no context
        console.warn("Cannot regenerate without active context.");
        // Try to get from lastVideoId if context is null but ID exists?
        chrome.storage.local.get(['lastVideoId'], async (result) => {
            if (result.lastVideoId) {
                const data = await window.ytStorage.getVideoData(result.lastVideoId);
                if (data && data.transcript) {
                    await generateSummary(data.url, data.title, data.transcript, true);
                }
            }
        });
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SUMMARIZE_VIDEO') {
        const url = request.videoUrl;
        const title = request.videoTitle || "Unknown Video";
        const transcript = request.transcript || null;
        generateSummary(url, title, transcript);
    } else if (request.type === 'UPDATE_SIDE_PANEL') {
        updatePanelForUrl(request.url, request.title);
    }
});

async function updatePanelForUrl(url, title) {
    if (!url || !url.includes("youtube.com/watch")) return;

    let videoId = null;
    try {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get("v");
    } catch (e) { return; }

    if (!videoId) return;

    // Check if we have data for this video
    try {
        const cachedData = await window.ytStorage.getVideoData(videoId);
        if (cachedData && cachedData.summary) {
            console.log("YT Summary: Tab switched, loading cached data for", videoId);

            // Restore UI
            document.getElementById('content').innerHTML = '';
            document.getElementById('error').style.display = 'none';
            document.getElementById('loading').style.display = 'none';

            displaySummary(cachedData.summary, cachedData.title || title, cachedData.url || url, null);

            // Restore Q&A
            if (cachedData.transcript) {
                document.getElementById('qa-section').style.display = 'flex';
                window.currentVideoContext = cachedData;

                clearChatUI();
                if (cachedData.chatHistory) {
                    cachedData.chatHistory.forEach(msg => appendChatMessage(msg.role, msg.text));
                }
            }

            chrome.storage.local.set({ lastVideoId: videoId });
        } else {
            console.log("YT Summary: Tab switched, no data for", videoId);
            // Show placeholder or "Ready to summarize" state?
            // If we blindly clear, we might annoy the user if they just haven't summarized yet.
            // But if they switch to a NEW video, showing the OLD summary is confusing.
            // So we SHOULD clear.

            // Only clear if the currently displayed video is DIFFERENT
            chrome.storage.local.get(['lastVideoId'], (result) => {
                if (result.lastVideoId !== videoId) {
                    resetPanelToPlaceholder();
                    chrome.storage.local.set({ lastVideoId: videoId });
                    window.currentVideoContext = null;
                }
            });
        }
    } catch (e) {
        console.error("Error updating panel:", e);
    }
}

function resetPanelToPlaceholder() {
    document.getElementById('content').innerHTML = '<p class="placeholder">Select a video and click "Summarize" to generate a summary.</p>';
    document.getElementById('qa-section').style.display = 'none';
    // input/separator are inside qa-section now, so hidden automatically.
    document.getElementById('resize-handle').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    clearChatUI();
}

async function generateSummary(videoUrl, videoTitle, transcript, forceRefresh = false) {
    const contentDiv = document.getElementById('content');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const qaSection = document.getElementById('qa-section');

    // Extract video ID from URL (simple regex)
    let videoId = null;
    try {
        const urlObj = new URL(videoUrl);
        videoId = urlObj.searchParams.get("v");
    } catch (e) { }

    // Check DB first logic (SKIP if forceRefresh is true)
    if (videoId && !forceRefresh) {
        try {
            const cachedData = await window.ytStorage.getVideoData(videoId);
            if (cachedData && cachedData.summary) {
                console.log("YT Summary: Loaded from cache for", videoId);

                // Restore UI from cache
                contentDiv.innerHTML = '';
                errorDiv.style.display = 'none';
                loadingDiv.style.display = 'none';

                displaySummary(cachedData.summary, cachedData.title || videoTitle, cachedData.url || videoUrl, null);

                // Restore Q&A
                if (cachedData.transcript) {
                    qaSection.style.display = 'flex';
                    // separator/input are children, no need to toggle
                    document.getElementById('resize-handle').style.display = 'flex'; // Show handle
                    window.currentVideoContext = cachedData;

                    clearChatUI();
                    if (cachedData.chatHistory) {
                        cachedData.chatHistory.forEach(msg => appendChatMessage(msg.role, msg.text));
                    }
                }

                // Update last video ID
                chrome.storage.local.set({ lastVideoId: videoId });
                return; // EXIT EARLY - DO NOT CALL GEMINI
            }
        } catch (e) {
            console.error("Error checking cache:", e);
            // Fallthrough to generate new summary
        }
    }

    // Reset UI for new generation
    contentDiv.innerHTML = '';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'flex';
    qaSection.style.display = 'none';
    if (forceRefresh) {
        // If refreshing, we probably want to keep chat history? 
        // User spec: "re-creating the summary".
        // Usually summary regeneration might invalidate old Q&A context if the summary changed drastically?
        // But the transcript is the same.
        // User spec says "clear the chat history" is the SECOND button.
        // So regeneration should probably NOT clear chat history automatically?
        // But typically a new summary means a "fresh start". 
        // Let's clear chat UI to be safe/clean, as the prompt might have changed etc.
        clearChatUI();
    } else {
        clearChatUI();
    }

    try {
        if (!transcript) {
            throw new Error('Could not extract transcript for this video. The video may not have captions available.');
        }

        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('Please set your Gemini API Key in the extension options.');
        }

        const { summary, promptUsed } = await callGeminiApi(apiKey, videoUrl, videoTitle, transcript);

        if (videoId) {
            // Save to DB
            await window.ytStorage.saveVideoData(videoId, {
                videoId: videoId,
                url: videoUrl,
                title: videoTitle,
                transcript: transcript,
                summary: summary,
                chatHistory: [] // New summary resets chat? Or keeps it? Let's reset for fresh start.
            });

            // Save last active ID to local storage for restoration
            chrome.storage.local.set({ lastVideoId: videoId });

            // Update context
            window.currentVideoContext = {
                videoId, url: videoUrl, title: videoTitle, transcript, summary, chatHistory: []
            };
        }

        displaySummary(summary, videoTitle, videoUrl, promptUsed);

        // Show Q&A section components
        qaSection.style.display = 'flex';
        // separator/input are children
        document.getElementById('resize-handle').style.display = 'flex';

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

function getStoredData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result));
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

// Q&A Functions

async function handleAskQuestion() {
    const input = document.getElementById('question-input');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    appendChatMessage('user', question);

    const qaSection = document.getElementById('qa-section');
    // Add loading indicator to chat
    const loadingId = 'qa-loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.textContent = "Thinking...";
    loadingDiv.style.fontStyle = "italic";
    loadingDiv.style.color = "#666";
    document.getElementById('chat-history').appendChild(loadingDiv);


    try {
        const context = window.currentVideoContext;
        if (!context || !context.transcript) throw new Error("No transcript found. Please summarize a video first.");

        const videoId = context.videoId;

        const apiKey = await getApiKey();
        if (!apiKey) throw new Error("API Key missing.");

        const history = context.chatHistory || [];

        // Construct detailed prompt with history
        let prompt = `You are a helpful assistant answering questions about a YouTube video based on its transcript. Use the provided transcript and conversation history to answer.\n\n` +
            `Transcript:\n${context.transcript}\n\n` +
            `Conversation History:\n`;

        history.forEach(msg => {
            prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n`;
        });

        prompt += `User: ${question}\nAssistant:`;

        const modelName = 'gemini-3-flash-preview';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Gemini API error");
        }

        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!answer) throw new Error("Empty response.");

        // Remove loading
        document.getElementById(loadingId).remove();

        appendChatMessage('assistant', answer);

        // Update history in memory and DB
        const newHistory = [...history, { role: 'user', text: question }, { role: 'assistant', text: answer }];
        context.chatHistory = newHistory; // Update memory

        if (videoId) {
            await window.ytStorage.saveChatHistory(videoId, newHistory);
        }

    } catch (e) {
        if (document.getElementById(loadingId)) document.getElementById(loadingId).remove();
        appendChatMessage('system', "Error: " + e.message);
    }
}

function appendChatMessage(role, text) {
    const historyDiv = document.getElementById('chat-history');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message ' + role;

    if (role === 'user') {
        msgDiv.innerHTML = `<strong>You:</strong> ${text}`; // Use Markdown-ish bold for "You"
    } else if (role === 'assistant') {
        msgDiv.innerHTML = formatMarkdown(text);
    } else {
        msgDiv.textContent = text;
    }

    historyDiv.appendChild(msgDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

async function clearChat() {
    clearChatUI();
    const context = window.currentVideoContext;
    if (context) {
        context.chatHistory = []; // Clear memory
        if (context.videoId) {
            await window.ytStorage.saveChatHistory(context.videoId, []); // Clear DB
        }
    }
}

function clearChatUI() {
    document.getElementById('chat-history').innerHTML = '';
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

