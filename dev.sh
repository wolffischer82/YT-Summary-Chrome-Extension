#!/bin/bash
# Get the absolute path of the project directory
PROJECT_DIR="$(pwd)"
PROFILE_DIR="$PROJECT_DIR/.chrome-profile"

echo "Project Dir: $PROJECT_DIR"
echo "Profile Dir: $PROFILE_DIR"

# Launch Chrome using an array to handle spaces correctly
CMD=(google-chrome --load-extension="$PROJECT_DIR" --user-data-dir="$PROFILE_DIR" --no-first-run "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

echo "Running: ${CMD[*]}"
"${CMD[@]}"
