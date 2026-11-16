# Kitten Chaos dev shortcuts.
# Requires `just` (https://github.com/casey/just) - for developers, not players.
# Players should just double-click play.command instead.

# Show available commands.
default:
    @just --list

# Install dependencies and start the dev server.
setup:
    npm install
    npm run dev

# Start the dev server (assumes packages already installed).
dev:
    npm run dev

# Run the test suite once.
test:
    npm test

# Type-check without emitting.
check:
    npm run typecheck

# Build the static production site into dist/.
build:
    npm run build
