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

    // We want to inject at the very beginning (left of Thumbs Up)
    // So we just pass the container. The injectButton function handles the prepend logic.
    injectButton(actionsContainer, null);
}

function injectButton(container, shareButton) {
    if (document.getElementById(BUTTON_ID)) return;

    // Create the container equivalent to <yt-button-view-model>
    const buttonContainer = document.createElement("div"); // youtube uses custom elements but we can use div or reuse their class structure if possible. 
    // Actually the user snippet shows: <yt-button-view-model ...><button-view-model ...><button ...>
    // We can't easily create 'yt-button-view-model' if it relies on internal polymer/lit logic, 
    // but we can create the DOM structure with the classes. 
    // However, custom elements might not render correctly if we just create them via document.createElement 
    // without the backing JS. 
    // SAFE BET: Use standard elements (div/button) with the CLASSES.

    // START DOM CONSTRUCTION

    // Outer Container (mimics yt-button-view-model)
    const wrapper = document.createElement("yt-button-view-model");
    wrapper.className = "ytd-menu-renderer";
    wrapper.id = "yt-summary-gemini-container";

    // Inner ViewModel (mimics button-view-model)
    const viewModel = document.createElement("button-view-model");
    viewModel.className = "ytSpecButtonViewModelHost style-scope ytd-menu-renderer";

    // The Button
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading yt-spec-button-shape-next--enable-backdrop-filter-experiment";
    button.setAttribute("aria-label", "Summarize");
    button.setAttribute("aria-label", "Summarize");
    // button.style.marginRight = "8px"; // START_REMOVED - Moved to CSS (container)

    // Icon
    const iconDiv = document.createElement("div");
    iconDiv.className = "yt-spec-button-shape-next__icon";
    iconDiv.setAttribute("aria-hidden", "true");

    // SVG Icon (Star/Sparkles for "Summarize")
    iconDiv.innerHTML = `
        <span class="ytIconWrapperHost" style="width: 24px; height: 24px;">
            <span class="yt-icon-shape ytSpecIconShapeHost">
                <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">
                    <svg viewBox="0 0 24 24" style="pointer-events: none; display: inherit; width: 100%; height: 100%;" focusable="false">
                        <path d="M7,2v11h3v9l7-12h-4l4-8H7z"/>
                    </svg>
                </div>
            </span>
        </span>
    `;

    // Text
    const textDiv = document.createElement("div");
    textDiv.className = "yt-spec-button-shape-next__button-text-content";
    textDiv.innerText = "Summarize";

    // Touch Feedback (Visual ripple effect container, might not work fully without JS but good for structure)
    const touchFeedback = document.createElement("yt-touch-feedback-shape");
    touchFeedback.className = "yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response";
    touchFeedback.setAttribute("aria-hidden", "true");
    touchFeedback.innerHTML = `
        <div class="yt-spec-touch-feedback-shape__stroke"></div>
        <div class="yt-spec-touch-feedback-shape__fill"></div>
    `;

    // Assembly
    button.appendChild(iconDiv);
    button.appendChild(textDiv);
    button.appendChild(touchFeedback);
    viewModel.appendChild(button);
    wrapper.appendChild(viewModel);

    // Event Listener
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

    // Injection: Inject before the "Like" button (ytd-segmented-like-dislike-button-renderer)
    // or fallback to first child.

    // The Like button is usually a <ytd-segmented-like-dislike-button-renderer>
    // The Like button is usually a <ytd-segmented-like-dislike-button-renderer> or <segmented-like-dislike-button-view-model>
    const likeButton = container.querySelector("ytd-segmented-like-dislike-button-renderer, segmented-like-dislike-button-view-model");

    if (likeButton) {
        // Fix: Ensure we insert into the DIRECT parent of the Like button
        // The Like button might be nested (e.g. inside #top-level-buttons-computed),
        // but our 'container' might be #actions (the grandparent).
        // insertBefore requires the reference node to be a direct child.
        likeButton.parentElement.insertBefore(wrapper, likeButton);
        console.log("YT Summary: Button injected LEFT of Like button");
    } else if (container.firstChild) {
        // Fallback: Just put it at the start
        container.insertBefore(wrapper, container.firstChild);
        console.log("YT Summary: Button injected at START of actions container (Like button not found)");
    } else {
        container.appendChild(wrapper);
        console.log("YT Summary: Button injected (appended to empty actions)");
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
