const fs = require('fs');
const path = require('path');

const DIST_CHROME_DIR = path.join(__dirname, 'dist', 'chrome');
const DIST_FIREFOX_DIR = path.join(__dirname, 'dist', 'firefox');
const SRC_DIR = path.join(__dirname, 'src');
const ICONS_DIR = path.join(__dirname, 'icons');
const MANIFEST_CHROME = path.join(__dirname, 'manifest.json');
const MANIFEST_FIREFOX = path.join(__dirname, 'manifest.firefox.json');

const target = process.argv[2] || 'all';

function buildChrome() {
    console.log('Building for Chrome...');
    if (fs.existsSync(DIST_CHROME_DIR)) {
        fs.rmSync(DIST_CHROME_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_CHROME_DIR, { recursive: true });

    fs.copyFileSync(MANIFEST_CHROME, path.join(DIST_CHROME_DIR, 'manifest.json'));

    if (fs.existsSync(ICONS_DIR)) {
        fs.cpSync(ICONS_DIR, path.join(DIST_CHROME_DIR, 'icons'), { recursive: true });
    }

    if (fs.existsSync(SRC_DIR)) {
        fs.cpSync(SRC_DIR, path.join(DIST_CHROME_DIR, 'src'), { recursive: true });
    }
}

function buildFirefox() {
    console.log('Building for Firefox...');
    if (fs.existsSync(DIST_FIREFOX_DIR)) {
        fs.rmSync(DIST_FIREFOX_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_FIREFOX_DIR, { recursive: true });

    fs.copyFileSync(MANIFEST_FIREFOX, path.join(DIST_FIREFOX_DIR, 'manifest.json'));

    if (fs.existsSync(ICONS_DIR)) {
        fs.cpSync(ICONS_DIR, path.join(DIST_FIREFOX_DIR, 'icons'), { recursive: true });
    }

    if (fs.existsSync(SRC_DIR)) {
        fs.cpSync(SRC_DIR, path.join(DIST_FIREFOX_DIR, 'src'), { recursive: true });
    }
}

if (target === 'chrome' || target === 'all') {
    buildChrome();
}

if (target === 'firefox' || target === 'all') {
    buildFirefox();
}

console.log('Build completed successfully!');
