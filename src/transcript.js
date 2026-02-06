// This script runs in the MAIN world (YouTube's page context).
// Communicates with the isolated-world content script via window.postMessage.

window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "YT_SUMMARY_GET_TRANSCRIPT") return;

    console.log("YT Summary [MAIN]: Transcript requested");

    try {
        const videoId = new URL(window.location.href).searchParams.get("v");
        if (!videoId) {
            console.error("YT Summary [MAIN]: No video ID in URL");
            window.postMessage({ type: "YT_SUMMARY_TRANSCRIPT_RESULT", transcript: null }, "*");
            return;
        }

        const transcript = await fetchTranscript(videoId);
        console.log("YT Summary [MAIN]: Result length:", transcript?.length ?? 0);
        window.postMessage({ type: "YT_SUMMARY_TRANSCRIPT_RESULT", transcript: transcript || null }, "*");

    } catch (e) {
        console.error("YT Summary [MAIN]: Error:", e);
        window.postMessage({ type: "YT_SUMMARY_TRANSCRIPT_RESULT", transcript: null }, "*");
    }
});

async function fetchTranscript(videoId) {
    // Step 1: Get INNERTUBE_API_KEY (from ytcfg or fallback)
    const apiKey = window.ytcfg?.get?.("INNERTUBE_API_KEY") || "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

    // Step 2: Call innertube player endpoint as ANDROID client
    // The Android client returns caption URLs without PoToken (exp=xpe) restrictions,
    // unlike the WEB client which blocks timedtext fetches.
    console.log("YT Summary [MAIN]: Calling innertube player as ANDROID client for:", videoId);

    const playerResponse = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: "ANDROID",
                        clientVersion: "20.10.38"
                    }
                },
                videoId: videoId
            })
        }
    );

    if (!playerResponse.ok) {
        console.error("YT Summary [MAIN]: Player API error:", playerResponse.status);
        return null;
    }

    const playerData = await playerResponse.json();

    // Check playability
    const status = playerData.playabilityStatus?.status;
    if (status !== "OK") {
        console.error("YT Summary [MAIN]: Video not playable:", status, playerData.playabilityStatus?.reason);
        return null;
    }

    const captionTracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
        console.warn("YT Summary [MAIN]: No caption tracks available");
        return null;
    }

    console.log("YT Summary [MAIN]: Found", captionTracks.length, "caption track(s)");

    // Prefer English, fall back to first available
    captionTracks.sort((a, b) => (a.languageCode === "en" ? -1 : 1));
    const track = captionTracks[0];
    console.log("YT Summary [MAIN]: Using track:", track.languageCode, track.kind === "asr" ? "(auto-generated)" : "(manual)");

    // Step 3: Fetch the transcript XML
    // Strip &fmt=srv3 to get default XML format with <text> elements
    const captionUrl = track.baseUrl.replace("&fmt=srv3", "");
    console.log("YT Summary [MAIN]: Fetching caption XML...");

    const captionResponse = await fetch(captionUrl);
    const xmlText = await captionResponse.text();

    if (!xmlText || xmlText.length === 0) {
        console.error("YT Summary [MAIN]: Empty caption response");
        return null;
    }

    console.log("YT Summary [MAIN]: Caption XML received, length:", xmlText.length);

    // Parse XML with regex (DOMParser is blocked by YouTube's Trusted Types policy)
    let fullText = "";
    const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let match;
    while ((match = regex.exec(xmlText)) !== null) {
        // Decode HTML entities
        let text = match[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<[^>]+>/g, ""); // strip any formatting tags like <i>
        fullText += text + " ";
    }

    return fullText.trim() || null;
}

console.log("YT Summary [MAIN]: Transcript helper ready");
