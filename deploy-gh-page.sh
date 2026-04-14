#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-AEExplainer}"

# Avoid repeated SSH passphrase prompts during gh-pages publish.
if ! ssh-add -l >/dev/null 2>&1; then
	eval "$(ssh-agent -s)" >/dev/null
fi
if ! ssh-add -l 2>/dev/null | grep -q "id_ed25519"; then
	echo "Loading SSH key ~/.ssh/id_ed25519 for deploy..."
	ssh-add ~/.ssh/id_ed25519
fi

PUBLIC_URL="/${REPO_NAME}" npm run build

mkdir -p ./dist
cp ./public/index.html ./dist/index.html
cp -r ./public/assets ./dist
cp -r ./public/bundle* ./dist
cp -r ./public/global.css ./dist

# Ensure GitHub Pages serves static files as-is.
touch ./dist/.nojekyll

# Optional SPA fallback for direct deep-link visits.
cp ./dist/index.html ./dist/404.html

COMMIT_SHA="$(git rev-parse --short HEAD)"
npx gh-pages -m "Deploy ${COMMIT_SHA}" -d ./dist