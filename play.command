#!/bin/bash
#
# Kitten Chaos launcher for friends & family.
# Just double-click this file in Finder. No terminal knowledge needed.
#

# Move to the folder this script lives in, no matter where it's launched from.
cd "$(dirname "$0")" || exit 1

# Double-clicked GUI scripts get a bare PATH, so add the usual spots Node lives.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/current/bin:$PATH"

echo ""
echo "  🐱  Kitten Chaos"
echo "  -----------------"
echo ""

# --- 1. Make sure Node is installed -----------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js isn't installed yet. It's a free tool this game needs."
  echo ""
  if command -v brew >/dev/null 2>&1; then
    echo "  Installing it for you now (this can take a few minutes)..."
    brew install node
  else
    echo "  Please install Node.js first:"
    echo "    1. Open https://nodejs.org in your browser"
    echo "    2. Download and run the installer (the big green button)"
    echo "    3. Double-click play.command again"
    echo ""
    read -r -p "  Press Enter to close this window."
    exit 1
  fi
fi

# --- 2. Download the game's packages (first run only) -----------------------
if [ ! -d node_modules ]; then
  echo "  Setting things up for the first time (downloading packages)..."
  echo ""
  npm install || { echo "  Setup failed. Please send this window to whoever shared the game."; read -r -p "  Press Enter to close."; exit 1; }
fi

# --- 3. Launch the game -----------------------------------------------------
echo ""
echo "  Starting the game... your browser will open in a moment."
echo "  Leave this window open while you play. Close it to stop the game."
echo ""
npm run dev
