// This script runs in the MAIN world (YouTube's page context).
// Communicates with the isolated-world content script via window.postMessage.

console.log("YT Summary [MAIN]: Transcript Script v2.0 LOADED");

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
    // Strategy: Try ANDROID client first (less restrictive), then fallback to WEB client.

    // Step 1: Get INNERTUBE_API_KEY
    const apiKey = window.ytcfg?.get?.("INNERTUBE_API_KEY") || "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

    console.log("YT Summary [MAIN]: Fetching transcript for", videoId);

    // Try ANDROID
    let transcript = await fetchTranscriptDispatched(videoId, apiKey, "ANDROID", "20.10.38");
    if (transcript) return transcript;

    console.warn("YT Summary [MAIN]: ANDROID client failed to return captions. Retrying with WEB client...");

    // Try WEB
    transcript = await fetchTranscriptDispatched(videoId, apiKey, "WEB", "2.20230920.00.00");
    if (transcript) return transcript;

    console.error("YT Summary [MAIN]: All clients failed to return captions.");
    return null;
}

async function fetchTranscriptDispatched(videoId, apiKey, clientName, clientVersion) {
    try {
        const playerResponse = await fetch(
            `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: clientName,
                        clientVersion: clientVersion
                    }
                },
                videoId: videoId
            })
        }
        );

        if (!playerResponse.ok) {
            console.error(`YT Summary [MAIN]: ${clientName} Player API error:`, playerResponse.status);
            return null;
        }

        const playerData = await playerResponse.json();

        // Check playability
        const status = playerData.playabilityStatus?.status;
        if (status !== "OK") {
            // Provide info but don't hard fail yet, let caption check decide
            // console.log(`YT Summary [MAIN]: ${clientName} Status:`, status);
        }

        const captionTracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captionTracks || captionTracks.length === 0) {
            console.warn(`YT Summary [MAIN]: ${clientName} No caption tracks found.`);
            return null;
        }

        console.log(`YT Summary [MAIN]: ${clientName} Found`, captionTracks.length, "caption track(s)");

        // Prefer English, fall back to first available
        captionTracks.sort((a, b) => {
            if (a.languageCode === 'en') return -1;
            if (b.languageCode === 'en') return 1;
            return 0;
        });
        const track = captionTracks[0];

        // Step 3: Fetch the transcript XML
        const captionUrl = track.baseUrl.replace("&fmt=srv3", "");
        console.log(`YT Summary [MAIN]: ${clientName} Fetching caption XML from`, captionUrl);

        const captionResponse = await fetch(captionUrl);
        const xmlText = await captionResponse.text();

        if (!xmlText || xmlText.length === 0) {
            console.error(`YT Summary [MAIN]: ${clientName} Empty caption response`);
            return null;
        }

        // Parse XML
        return parseTranscriptXML(xmlText);

    } catch (e) {
        console.error(`YT Summary [MAIN]: ${clientName} Exception:`, e);
        return null;
    }
}

function parseTranscriptXML(xmlText) {
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
            .replace(/<[^>]+>/g, "");
        fullText += text + " ";
    }
    return fullText.trim() || null;
}
