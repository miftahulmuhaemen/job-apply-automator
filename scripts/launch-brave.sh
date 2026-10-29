#!/bin/bash
# Launch user's authentic desktop Brave browser on Windows with Remote Debugging Port 9222
# Bound strictly to the project's isolated user-data-dir: ./data/browser_profile
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROFILE_DIR="$PROJECT_ROOT/data/browser_profile"

mkdir -p "$PROFILE_DIR"

BRAVE_PATH="/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
CHROME_PATH="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"

TARGET_BROWSER=""
if [ -f "$BRAVE_PATH" ]; then
  TARGET_BROWSER="$BRAVE_PATH"
elif [ -f "$CHROME_PATH" ]; then
  TARGET_BROWSER="$CHROME_PATH"
elif command -v google-chrome >/dev/null 2>&1; then
  TARGET_BROWSER="$(command -v google-chrome)"
else
  echo "[ERROR] No desktop browser (Brave or Chrome) found."
  exit 1
fi

if [[ "$TARGET_BROWSER" == *.exe ]]; then
  C_USERS="/mnt/c/Users"
  WIN_USER=$(ls -1 "$C_USERS" | grep -v -E "^(Default|Public|All Users|Default User|desktop.ini|WsiAccount)$" | head -n 1)
  WIN_PROFILE_DIR="C:/Users/$WIN_USER/.job_apply_automator/browser_profile"
  mkdir -p "/mnt/c/Users/$WIN_USER/.job_apply_automator/browser_profile"
  TARGET_URL="${1:-https://www.kalibrr.com/login?locale=id_ID}"
  echo "[BROWSER] Launching desktop browser: $TARGET_BROWSER"
  echo "[BROWSER] User Data Profile: $WIN_PROFILE_DIR"
  echo "[BROWSER] Remote Debugging Port: 9222"
  echo "[BROWSER] Target URL: $TARGET_URL"
  "$TARGET_BROWSER" \
    --user-data-dir="$WIN_PROFILE_DIR" \
    --profile-directory=Default \
    --disable-profile-picker \
    --remote-debugging-port=9222 \
    --remote-debugging-address=0.0.0.0 \
    --remote-allow-origins=* \
    --no-first-run \
    --no-default-browser-check \
    "$TARGET_URL" &
else
  TARGET_URL="${1:-https://www.kalibrr.com/login?locale=id_ID}"
  echo "[BROWSER] Launching Linux browser: $TARGET_BROWSER"
  "$TARGET_BROWSER" \
    --user-data-dir="$PROFILE_DIR" \
    --profile-directory=Default \
    --disable-profile-picker \
    --remote-debugging-port=9222 \
    --remote-debugging-address=0.0.0.0 \
    --no-first-run \
    --no-default-browser-check \
    "$TARGET_URL" &
fi

echo "[BROWSER] Browser launched cleanly on port 9222."
