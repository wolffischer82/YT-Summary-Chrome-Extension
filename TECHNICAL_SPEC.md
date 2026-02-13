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

3.  **Background Script / Service Worker**:
    -   Handles extension lifecycle events.
    -   Manages API key storage (sync storage).

## Data Flow
1.  User clicks "Summarize".
2.  Content script fetches video transcript.
3.  Transcript is sent to Gemini API (3.0 Flash).
4.  Gemini returns summary text.
5.  Summary is rendered in the Side Panel.

## Tech Stack
-   **HTML/CSS/JS**: Vanilla implementation.
-   **Google Gemini API**: For text generation.
-   **Browser Extension APIs**: `storage`, `sidePanel`, `scripting`.

## Security
-   API Key is stored in `chrome.storage.sync` and not exposed.
-   Content Security Policy (CSP) restricts external sources.
