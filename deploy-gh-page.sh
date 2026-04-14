#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-AEExplainer}"
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