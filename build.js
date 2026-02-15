const fs = require('fs');
const path = require('path');

const DIST_CHROME_DIR = path.join(__dirname, 'dist', 'chrome');
const DIST_FIREFOX_DIR = path.join(__dirname, 'dist', 'firefox');
const SRC_DIR = path.join(__dirname, 'src');
const ICONS_DIR = path.join(__dirname, 'icons');
const MANIFEST_FILE = path.join(__dirname, 'manifest.json');

// Ensure dist directory exists and is empty
if (fs.existsSync(DIST_CHROME_DIR)) {
    fs.rmSync(DIST_CHROME_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_CHROME_DIR);

if (fs.existsSync(DIST_FIREFOX_DIR)) {
    fs.rmSync(DIST_FIREFOX_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_FIREFOX_DIR);

// Copy manifest.json
fs.copyFileSync(MANIFEST_FILE, path.join(DIST_CHROME_DIR, 'manifest.json'));
fs.copyFileSync(MANIFEST_FILE, path.join(DIST_FIREFOX_DIR, 'manifest.json'));

// Copy icons directory
if (fs.existsSync(ICONS_DIR)) {
    fs.cpSync(ICONS_DIR, path.join(DIST_CHROME_DIR, 'icons'), { recursive: true });
    fs.cpSync(ICONS_DIR, path.join(DIST_FIREFOX_DIR, 'icons'), { recursive: true });
}

// Copy src directory
if (fs.existsSync(SRC_DIR)) {
    fs.cpSync(SRC_DIR, path.join(DIST_CHROME_DIR, 'src'), { recursive: true });
    fs.cpSync(SRC_DIR, path.join(DIST_FIREFOX_DIR, 'src'), { recursive: true });
}

console.log('Build completed successfully!');
