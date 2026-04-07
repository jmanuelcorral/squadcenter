#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-${1:-}}"
if [ -z "$VERSION" ]; then
  echo "Usage: VERSION=x.y.z ./setup.sh"
  exit 1
fi

GITHUB_REPO="${GITHUB_REPO:-jmanuelcorral/squadcenter}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="/tmp/apt-repo"
DEPLOY_DIR="/tmp/apt-deploy"

# Install reprepro if not present
if ! command -v reprepro &> /dev/null; then
  echo "Installing reprepro..."
  sudo apt-get update -qq && sudo apt-get install -y -qq reprepro
fi

# Setup reprepro structure
mkdir -p "$WORK_DIR/conf"
cp "$SCRIPT_DIR/conf/distributions" "$WORK_DIR/conf/"
cat > "$WORK_DIR/conf/options" << EOF
verbose
basedir $WORK_DIR
EOF

# Import GPG key if provided
if [ -n "${GPG_PRIVATE_KEY:-}" ]; then
  echo "$GPG_PRIVATE_KEY" | gpg --batch --import
fi

# Download .deb from GitHub Releases
DEB_FILE="squad-center_${VERSION}_amd64.deb"
DEB_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${DEB_FILE}"
echo "Downloading $DEB_URL..."
curl -fsSL -o "/tmp/${DEB_FILE}" "$DEB_URL"

# Add to repo
reprepro -b "$WORK_DIR" includedeb stable "/tmp/${DEB_FILE}"

# Export public key
gpg --batch --export --armor > "$WORK_DIR/gpg-key.public"

# Prepare deploy directory
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/apt"
cp -r "$WORK_DIR/dists" "$DEPLOY_DIR/apt/"
cp -r "$WORK_DIR/pool" "$DEPLOY_DIR/apt/"
cp "$WORK_DIR/gpg-key.public" "$DEPLOY_DIR/"

echo "Apt repo ready at: $DEPLOY_DIR"
