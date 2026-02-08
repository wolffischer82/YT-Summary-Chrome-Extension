# YT Summary with Gemini

A Chrome extension that summarizes YouTube videos using Google's Gemini 3.0 Flash model.

## Features

- **Summarize Button**: Adds a "Summarize" button next to the Like/Dislike buttons on YouTube video pages.
- **Side Panel**: Opens a side panel to display the summary.
- **Gemini Integration**: Uses the Gemini API (API key from aistudio.google.com required!) to generate concise summaries of video transcripts.

## Installation

### Load Unpacked (for development)

1.  Clone or download this repository.
2.  Open Chrome and go to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory containing this project.

### Install from Zip (for distribution)

1.  Download the `yt-summary-extension.zip` file.
2.  Unzip the file.
3.  Follow the "Load Unpacked" steps above, selecting the unzipped folder.

## Packaging

To create a zip file for distribution:

1.  Ensure you have `zip` installed.
2.  Run the following command:

```bash
npm run package
```

This will create `yt-summary-extension.zip` in the project root, excluding development files.

## Configuration

To use the extension, you need a Gemini API key.
(Add details here if there's an options page logic for entering the key, checking `src/options/options.js`)
