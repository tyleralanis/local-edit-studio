#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen is not installed."
  echo "Install it with: brew install xcodegen"
  exit 1
fi
xcodegen generate
open LocalEditStudio.xcodeproj
