#!/bin/bash
# Get the absolute path of the project directory
PROJECT_DIR="$(pwd)"
DIST_DIR="$PROJECT_DIR/dist/firefox"

# Build for Firefox first to ensure the manifest is correct
echo "Building for Firefox..."
node build.js firefox

echo "Project Dir: $PROJECT_DIR"
echo "Dist Dir: $DIST_DIR"

# Launch Firefox using web-ext
# We assume web-ext is installed in node_modules (devDependency)
WEB_EXT="./node_modules/.bin/web-ext"

if [ ! -f "$WEB_EXT" ]; then
    echo "web-ext not found locally, trying global..."
    WEB_EXT="web-ext"
fi

PROFILE_DIR="$PROJECT_DIR/.firefox-profile"

if [ ! -d "$PROFILE_DIR" ]; then
    echo "Creating Firefox profile directory at $PROFILE_DIR"
    mkdir -p "$PROFILE_DIR"
fi

"$WEB_EXT" run --source-dir "$DIST_DIR" --firefox-profile "$PROFILE_DIR" --keep-profile-changes --start-url "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --browser-console
