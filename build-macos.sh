#!/bin/bash
# Build the independent macOS app from both source trees.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
if ! command -v bun >/dev/null 2>&1; then
  export PATH="$(dirname "$PROJECT_ROOT")/.tools/node_modules/.bin:$PATH"
fi
command -v bun >/dev/null 2>&1 || { echo 'Please install Bun first.' >&2; exit 1; }
BUILD_ROOT="$PROJECT_ROOT/.build"
BUNDLE_DIR="$BUILD_ROOT/backend-bundle"
mkdir -p "$BUNDLE_DIR" "$BUILD_ROOT/backend-data" "$BUILD_ROOT/electron-cache"

cd "$PROJECT_ROOT/AionCore"
CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" cargo build --locked --release --bin aioncore
cp target/release/aioncore "$BUNDLE_DIR/aioncore"
"$BUNDLE_DIR/aioncore" --data-dir "$BUILD_ROOT/backend-data" prepare-managed-resources --bundle-out "$BUNDLE_DIR/managed-resources"

cd "$PROJECT_ROOT/AionUi"
bun install --frozen-lockfile
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" bun run package
node scripts/build-mcp-servers.js
export AIONUI_BACKEND_LOCAL_BUNDLE_DIR="$BUNDLE_DIR"
node - <<'JS'
const { prepareAioncore } = require('./packages/shared-scripts/src/prepare-aioncore.js');
const pkg = require('./package.json');
prepareAioncore({projectRoot: process.cwd(), platform: process.platform, arch: process.arch, version: pkg.aioncoreVersion});
JS
node scripts/prepareHubResources.js
export ELECTRON_CACHE="$BUILD_ROOT/electron-cache"
export CSC_IDENTITY_AUTO_DISCOVERY=false
bunx electron-builder --config packages/desktop/electron-builder.yml --mac dmg --arm64 --publish=never --config.electronDist=node_modules/electron/dist
