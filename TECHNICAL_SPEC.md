# Technical Specification

## Architecture
The extension operates as a Chrome/Firefox browser extension using Manifest V3.

### Core Components
1.  **Content Script (`src/content.js`)**:
    -   Injected into YouTube video pages.
    -   Injects the "Summarize" button into the DOM.
    -   Extracts video ID and caption/transcript data.
    -   Communicates with the background script/side panel.

2.  **Side Panel**:
    -   Displays the generated summary.
    -   interactions with the Gemini API (if not handled in background).
    -   **Layout**:
        -   Fixed Header.
        -   Scrollable Summary/Content area.
        -   Fixed Bottom Q&A Input section.
        -   **Header**: Contains "Video Summary" title and Action Buttons (Regenerate, Clear Chat).

3.  **Background Script / Service Worker**:
    -   Handles extension lifecycle events.
    -   Manages API key storage (sync storage).

## Data Flow
1.  User clicks "Summarize".
2.  **Check Cache**: Extension checks IndexedDB for existing data for the video ID.
    -   **If found**: Load summary, transcript, and chat history immediately.
    -   **If not found**: Proceed to fetch transcript.
3.  Content script fetches video transcript (via Main world script).
4.  Transcript is sent to Gemini API (3.0 Flash).
5.  Gemini returns summary text.
6.  Summary is rendered in the Side Panel and saved to IndexedDB.

### Q&A Workflow
1.  User enters a question.
2.  Extension retrieves `lastTranscript` and `chatHistory` from storage.
3.  Extension sends Transcript + History + New Question to Gemini.
4.  Gemini returns answer.
5.  Answer is displayed and History is updated/saved.

## Transcript Fetching Strategy
To ensure reliability across different video types (including age-restricted or copyright-sensitive content), the extension uses a multi-client fallback strategy:
1.  **Primary**: Attempt to fetch captions using the internal `ANDROID` client API (less restrictive).
2.  **Fallback**: If `ANDROID` fails (e.g., "No caption tracks available"), retry using the `WEB` client API.
3.  **Result**: Returns the first successful transcript or `null` if both fail.

## Tech Stack
-   **HTML/CSS/JS**: Vanilla implementation.
-   **Google Gemini API**: For text generation.
-   **Browser Extension APIs**: `storage` (sync for settings), `sidePanel`, `scripting`.
-   **IndexedDB**: For storing per-video data (summaries, transcripts, chat history).

## Security
-   API Key is stored in `chrome.storage.sync` and not exposed.
-   Content Security Policy (CSP) restricts external sources.
