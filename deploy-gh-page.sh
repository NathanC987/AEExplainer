#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-AEExplainer}"
COMMIT_SHA="$(git rev-parse --short HEAD)"
DEPLOY_VERSION="$(date +%s)-${COMMIT_SHA}"

# Avoid repeated SSH passphrase prompts during gh-pages publish.
if ! ssh-add -l >/dev/null 2>&1; then
	eval "$(ssh-agent -s)" >/dev/null
fi
if ! ssh-add -l 2>/dev/null | grep -q "id_ed25519"; then
	echo "Loading SSH key ~/.ssh/id_ed25519 for deploy..."
	ssh-add ~/.ssh/id_ed25519
fi

PUBLIC_URL="/${REPO_NAME}" BUILD_VERSION="${DEPLOY_VERSION}" npm run build

mkdir -p ./dist
cp ./public/index.html ./dist/index.html
cp -r ./public/assets ./dist
cp -r ./public/bundle* ./dist
cp -r ./public/global.css ./dist

# Cache-bust top-level entry assets so every deployment serves fresh files.
sed -i \
	-e "s|href=\"global.css\"|href=\"global.css?v=${DEPLOY_VERSION}\"|g" \
	-e "s|href=\"bundle.css\"|href=\"bundle.css?v=${DEPLOY_VERSION}\"|g" \
	-e "s|src=\"bundle.js\"|src=\"bundle.js?v=${DEPLOY_VERSION}\"|g" \
	./dist/index.html

# Ensure GitHub Pages serves static files as-is.
touch ./dist/.nojekyll

# Optional SPA fallback for direct deep-link visits.
cp ./dist/index.html ./dist/404.html

DEPLOY_DIR="$(mktemp -d)"
cleanup() {
	git worktree remove "${DEPLOY_DIR}" --force >/dev/null 2>&1 || true
	git worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT

# If a previous run crashed, gh-pages may still be registered as an active
# worktree. Remove/prune it so repeated deploys do not fail.
EXISTING_GH_PAGES_WORKTREE="$(git worktree list --porcelain | awk '/^worktree / {wt=$2} /^branch refs\/heads\/gh-pages$/ {print wt}')"
if [[ -n "${EXISTING_GH_PAGES_WORKTREE}" ]]; then
	git worktree remove "${EXISTING_GH_PAGES_WORKTREE}" --force >/dev/null 2>&1 || true
	git worktree prune >/dev/null 2>&1 || true
fi

if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
	git worktree add -B gh-pages "${DEPLOY_DIR}" origin/gh-pages >/dev/null
else
	git worktree add --detach "${DEPLOY_DIR}" >/dev/null
	(
		cd "${DEPLOY_DIR}"
		git checkout --orphan gh-pages >/dev/null
		git rm -rf . >/dev/null 2>&1 || true
	)
fi

find "${DEPLOY_DIR}" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r ./dist/. "${DEPLOY_DIR}"/

(
	cd "${DEPLOY_DIR}"
	touch .nojekyll
	git add -A
	if git diff --cached --quiet; then
		echo "No deploy changes to publish."
	else
		git commit -m "Deploy ${COMMIT_SHA}" >/dev/null
		git push origin gh-pages
		echo "Published to gh-pages."
	fi
)