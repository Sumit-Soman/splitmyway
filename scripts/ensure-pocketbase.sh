#!/usr/bin/env bash
# Downloads PocketBase CLI into tools/pocketbase if missing (macOS arm64).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PB="$ROOT/tools/pocketbase"
if [[ -x "$PB" ]]; then exit 0; fi
mkdir -p "$ROOT/tools"
VER="${POCKETBASE_VERSION:-0.25.8}"
ARCH="$(uname -m)"
case "$ARCH" in
  arm64) ZIP="pocketbase_${VER}_darwin_arm64.zip" ;;
  x86_64) ZIP="pocketbase_${VER}_darwin_amd64.zip" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac
URL="https://github.com/pocketbase/pocketbase/releases/download/v${VER}/${ZIP}"
echo "Downloading PocketBase ${VER}..."
curl -sL "$URL" -o /tmp/pb-ensure.zip
unzip -o -q /tmp/pb-ensure.zip pocketbase -d "$ROOT/tools"
chmod +x "$PB"
echo "Installed $PB"
