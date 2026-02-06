// YouTube uses a Single Page Application architecture, so we need to observe DOM changes
// and re-inject the button when the video page changes or re-renders.

let observer = null;
let debounceTimer = null;

const BUTTON_ID = "yt-summary-gemini-button";
const SHARE_TERMS = ["Share", "Teilen", "Compartir", "Partager", "Condividi", "Compartilhar"];

function init() {
    console.log("YT Summary: Initializing content script");
    startObserver();
    checkForInjectionPoint();

    // YouTube SPA navigation events
    document.addEventListener("yt-navigate-finish", () => {
        checkForInjectionPoint();
    });
}

function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
        // Debounce: YouTube DOM is extremely active
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkForInjectionPoint, 300);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function checkForInjectionPoint() {
    if (!window.location.href.includes("/watch")) return;
    if (document.getElementById(BUTTON_ID)) return;

    // Current YouTube (2025+) uses #actions container with yt-button-view-model children
    const actionsContainer = document.querySelector("ytd-watch-metadata #actions");
    if (!actionsContainer) return;

    // Find the Share button: it's a <yt-button-view-model> whose text matches a share term
    const viewModels = actionsContainer.querySelectorAll("yt-button-view-model");
    let shareButton = null;

    for (const vm of viewModels) {
        const text = (vm.innerText || "").trim();
        if (SHARE_TERMS.some(term => text.toLowerCase().includes(term.toLowerCase()))) {
            shareButton = vm;
            break;
        }
    }

    if (shareButton) {
        injectButton(shareButton.parentElement, shareButton);
    } else if (actionsContainer.children.length > 0) {
        // Fallback: append to actions container if share button not found
        injectButton(actionsContainer, null);
    }
}

function injectButton(container, shareButton) {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 18px;
        height: 36px;
        padding: 0 16px;
        font-size: 14px;
        font-weight: 500;
        font-family: "YouTube Sans", Roboto, Arial, sans-serif;
        cursor: pointer;
        background-color: #cc0000;
        color: #ffffff;
        margin-right: 8px;
    `;

    button.innerHTML = `
        <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-right:6px;fill:currentColor"><path d="M7,2v11h3v9l7-12h-4l4-8H7z"/></svg>
        <span>Summarize</span>
    `;

    button.addEventListener("click", async () => {
        const videoUrl = window.location.href;
        console.log("YT Summary: Summarize clicked for:", videoUrl);

        chrome.runtime.sendMessage({
            type: "OPEN_SIDE_PANEL",
            videoUrl: videoUrl,
            videoTitle: document.title.replace(" - YouTube", "")
        });

        const transcript = await getTranscript();

        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SUMMARIZE_VIDEO",
                videoUrl: videoUrl,
                videoTitle: document.title.replace(" - YouTube", ""),
                transcript: transcript
            });
        }, 500);
    });

    if (shareButton) {
        container.insertBefore(button, shareButton);
        console.log("YT Summary: Button injected LEFT of Share button");
    } else {
        container.appendChild(button);
        console.log("YT Summary: Button injected (appended to actions)");
    }
}

// Transcript extraction — delegates to the MAIN world script (src/transcript.js)
// which has direct access to YouTube's player API and valid session cookies.
function getTranscript() {
    return new Promise((resolve) => {
        console.log("YT Summary: Requesting transcript from MAIN world...");

        const listener = (event) => {
            if (event.source !== window) return;
            if (event.data?.type !== "YT_SUMMARY_TRANSCRIPT_RESULT") return;
            window.removeEventListener("message", listener);
            clearTimeout(timeout);

            const transcript = event.data.transcript;
            console.log("YT Summary: Received transcript, length:", transcript?.length ?? 0);
            resolve(transcript);
        };

        window.addEventListener("message", listener);
        window.postMessage({ type: "YT_SUMMARY_GET_TRANSCRIPT" }, "*");

        const timeout = setTimeout(() => {
            window.removeEventListener("message", listener);
            console.error("YT Summary: Transcript request timed out (5s)");
            resolve(null);
        }, 5000);
    });
}

init();
