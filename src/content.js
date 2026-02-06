// YouTube uses a Single Page Application architecture, so we need to observe DOM changes
// and re-inject the button when the video page changes or re-renders.

let observer = null;
let currentVideoUrl = "";

const BUTTON_ID = "yt-summary-gemini-button";

function init() {
    console.log("YT Summary: Initializing content script");
    startObserver();
    // Attempt to inject immediately if already on a video page
    checkForInjectionPoint();
}

function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
        // Optimization: check if relevant nodes are added? 
        // Or just throttle check?
        // YouTube DOM is heavy, so we want to be specific if possible.
        // However, the buttons container is often re-rendered.
        checkForInjectionPoint();
    });

    // Observe layout changes
    const targetNode = document.body;
    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });
}

function checkForInjectionPoint() {
    // Only inject on video pages
    if (!window.location.href.includes("/watch")) {
        return;
    }

    if (document.getElementById(BUTTON_ID)) {
        return; // Already injected
    }

    // Target: The row of buttons (Like, Share, Download, etc.)
    // We specifically want to be LEFT of the Share button.

    // Strategy 1: Look for the specific <ytd-share-button-renderer> tag (Language agnostic)
    const shareNode = document.querySelector("ytd-share-button-renderer");
    if (shareNode) {
        // The container is usually the parent or the flex container holding it
        // ytd-share-button-renderer is often a direct sibling of other buttons in the menu
        injectButton(shareNode.parentElement, shareNode);
        return;
    }

    let container = null;
    let shareButton = null;

    // Strategy 2: Look for specific text content (German/English/etc.)
    // Matches the user provided structure: <div class="...button-text-content">Teilen</div>
    const textNodes = document.querySelectorAll(".yt-spec-button-shape-next__button-text-content");
    for (const node of textNodes) {
        const txt = node.textContent.trim();
        if (txt === "Teilen" || txt === "Share" || txt === "Compartir") {
            // Found the label. Now find the wrapper button/renderer.
            // Structure is usually: ytd-button-renderer > ... > button > ... > div.text-content
            // We need to inject before the ytd-button-renderer (the top level sibling in the menu)
            const wrapper = node.closest('ytd-button-renderer') || node.closest('button');
            if (wrapper) {
                shareButton = wrapper;
                container = wrapper.parentElement; // The container holding all buttons
                break;
            }
        }
    }

    if (container && shareButton) {
        injectButton(container, shareButton);
        return;
    }

    // Strategy 3: Iterate over known containers and check button text/aria
    // (Fallback if previous strategies failed)
    const selectors = [
        "#top-level-buttons-computed",
        "ytd-menu-renderer #top-level-buttons-computed",
        "#actions-inner #top-level-buttons-computed",
        "ytd-menu-renderer" // Fallback broad container
    ];

    const shareTerms = ["Share", "Teilen", "Compartir", "Partager", "Condividi"];

    for (const sel of selectors) {
        const candidates = document.querySelectorAll(sel);
        for (const cand of candidates) {
            const buttons = cand.querySelectorAll('button, ytd-button-renderer');
            if (buttons.length < 2 && sel === "ytd-menu-renderer") continue;

            for (const btn of buttons) {
                const text = (btn.innerText + " " + (btn.getAttribute("aria-label") || "")).toLowerCase();
                if (shareTerms.some(term => text.includes(term.toLowerCase()))) {
                    container = cand;
                    shareButton = btn.closest('ytd-button-renderer') || btn;
                    break;
                }
            }
            if (container) break;
        }
        if (container) break;
    }

    if (container && shareButton) {
        injectButton(container, shareButton);
    } else if (container) {
        // Fallback: just append if finding share button failed
        injectButton(container, null);
    } else {
        // Absolute fallback: Blind selector if logic failed
        const blindContainer = document.querySelector("#top-level-buttons-computed");
        if (blindContainer) {
            injectButton(blindContainer, null);
        }
    }
}

function injectButton(container, shareButton) {
    if (document.getElementById(BUTTON_ID)) return;

    // Create Button
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m"; // YouTube native classes for look & feel

    // Fallback styling if classes don't match perfect (YouTube updates classes often)
    // We'll mimic the "Share" button style which is usually "tonal" (gray background)
    button.style.marginLeft = "8px";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.border = "none";
    button.style.borderRadius = "18px"; // Standard pill shape
    button.style.height = "36px";
    button.style.padding = "0 16px";
    button.style.fontSize = "14px";
    button.style.fontWeight = "500";
    // Style explicitly to be visible (User reported black space)
    button.style.backgroundColor = "#cc0000"; // YouTube Red
    button.style.color = "#ffffff"; // White text
    button.style.marginLeft = "8px";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.border = "none";
    button.style.borderRadius = "18px";
    button.style.height = "36px";
    button.style.padding = "0 16px";
    button.style.fontSize = "14px";
    button.style.fontWeight = "500";
    button.style.fontFamily = "Roboto, Arial, sans-serif";
    button.style.cursor = "pointer";
    button.style.zIndex = "999"; // Ensure it's on top if there's stacking issues

    // Icon + Text
    button.innerHTML = `
        <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" style="pointer-events: none; display: block; width: 24px; height: 24px; margin-right: 6px; fill: currentColor;"><g><path d="M7,2v11h3v9l7-12h-4l4-8H7z"></path></g></svg>
        <span>Summarize</span>
    `;

    button.addEventListener("click", async () => {
        const videoUrl = window.location.href;
        console.log("Summarize clicked for:", videoUrl);

        // Notify Background / Sidepanel
        chrome.runtime.sendMessage({
            type: "OPEN_SIDE_PANEL", // Background handles opening
            videoUrl: videoUrl,
            videoTitle: document.title.replace(" - YouTube", "")
        });

        // Fetch transcript asynchronously
        const transcript = await getTranscript();

        // Also send directly to sidepanel in case it's already open and listening
        // (Background might handle the open, but sidepanel needs the data)
        // A slight delay to ensure sidepanel is ready if it was just opened?
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SUMMARIZE_VIDEO",
                videoUrl: videoUrl,
                videoTitle: document.title.replace(" - YouTube", ""),
                transcript: transcript
            });
        }, 500);
    });

    // Insert before the Share button if found, otherwise append
    if (shareButton) {
        // Adjust margins: Add margin-right to our button, or margin-left to share button?
        // Usually YouTube buttons have gaps.
        button.style.marginRight = "8px";
        button.style.marginLeft = "0px"; // Reset from previous

        container.insertBefore(button, shareButton);
        console.log("YT Summary: Button injected LEFT of Share button");
    } else {
        container.appendChild(button);
        console.log("YT Summary: Button injected (Appended)");
    }
}

// Transcript Extraction Logic
async function getTranscript() {
    try {
        console.log("YT Summary: Attempting to fetch transcript...");

        // 1. Get Player Response
        // YouTube stores player data in ytInitialPlayerResponse.
        // In content script, we can't access window variables directly due to isolation.
        // We have to scrape it from script tags or inject a script to retrieve it.
        // Easier method: Scrape from script tags if available in DOM.

        let playerResponse = null;

        // Try scraping script tags
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            if (script.textContent.includes('var ytInitialPlayerResponse =')) {
                const text = script.textContent;
                const start = text.indexOf('var ytInitialPlayerResponse =') + 'var ytInitialPlayerResponse ='.length;
                const end = text.indexOf(';', start);
                const jsonStr = text.substring(start, end);
                try {
                    playerResponse = JSON.parse(jsonStr);
                    break;
                } catch (e) { }
            }
        }

        // Fallback: Sometimes it's pushed to window (requires extraction injection), 
        // OR we can try to find it in the new yt structure (yt-player-config).

        // BETTER STRATEGY for SPA (Single Page App):
        // The script tag might be stale if the user navigated. 
        // Real-time data is often in the `ytd-app` custom element's data, which is hard to access from content script.
        // HOWEVER, `youtube.com/watch` usually reloads data.

        // Let's try to fetch it via fetch() if we assume we have the video ID.
        // Video ID is in URL.
        // Actually, let's try the simplest route first: Parsing the current page HTML text might be enough if it's not too dynamic?
        // No, SPA navigation updates the video without updating the raw HTML source usually.

        // Alternative: Use a library-like logic.
        // Search for "captionTracks" in the document body text? (Risky/Performance heavy)

        // Let's look for `ytInitialPlayerResponse` again.
        if (!playerResponse) {
            // Maybe it's in a window variable we can't see?
            // Since we can't easily execute script in page context to return data to us without message passing setup...
            // Let's rely on the fact that `response` might be available via a fetch to `get_video_info` or similar? 
            // That's complex (CORS/Auth).

            // Simple hack: The `ytInitialPlayerResponse` is often attached to the DOM or readable.
            // Actually, `document.body.innerHTML` might contain it?
            // Re-reading script tags is good for initial load.

            // If we are on a navigated page, `ytInitialPlayerResponse` on the `window` object is updated.
            // But we can't see `window.ytInitialPlayerResponse`.
            // We CAN inject a script to get it.

            return extractTranscriptFromPageContext();
        }

        return parseTranscript(playerResponse);

    } catch (e) {
        console.error("YT Summary: Transcript extraction failed", e);
        return null;
    }
}

function extractTranscriptFromPageContext() {
    return new Promise((resolve) => {
        // Inject a script that posts the message back to us
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                try {
                    const playerResponse = window.ytInitialPlayerResponse || 
                                         document.getElementById('movie_player')?.getPlayerResponse(); // Better API if player exists
                    
                    if (playerResponse) {
                        window.postMessage({ type: 'YT_SUMMARY_PLAYER_RESPONSE', data: playerResponse }, '*');
                    } else {
                        window.postMessage({ type: 'YT_SUMMARY_PLAYER_RESPONSE', data: null }, '*');
                    }
                } catch(e) {
                    window.postMessage({ type: 'YT_SUMMARY_PLAYER_RESPONSE', data: null }, '*');
                }
            })();
        `;

        const listener = (event) => {
            if (event.source === window && event.data.type === 'YT_SUMMARY_PLAYER_RESPONSE') {
                window.removeEventListener('message', listener);
                resolve(parseTranscript(event.data.data));
            }
        };

        window.addEventListener('message', listener);
        (document.head || document.documentElement).appendChild(script);
        script.remove();

        // Timeout
        setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve(null);
        }, 2000);
    });
}

function parseTranscript(playerResponse) {
    if (!playerResponse) return null;

    // Locate captions
    const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) return null;

    // Prefer English, or default to first
    // Checks for 'en' or 'std' (auto-generated usually has kind=asr)
    // Let's sort to find best track.
    captions.sort((a, b) => {
        return (a.languageCode === 'en' ? -1 : 1);
    });

    const track = captions[0];
    const baseUrl = track.baseUrl;

    // Fetch the XML/JSON
    return fetch(baseUrl)
        .then(res => res.text())
        .then(xml => {
            // Parse XML to text
            // Format is usually: <text start="0" dur="2">Hello</text>
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, "text/xml");
            const texts = doc.querySelectorAll('text');
            let fullText = "";
            texts.forEach(t => {
                fullText += t.textContent + " ";
            });
            return fullText.trim(); // Limit length if needed? Gemini 3.0 has huge context :)
        })
        .catch(err => {
            console.error("Error fetching caption text:", err);
            return null;
        });
}

// Run
init();
