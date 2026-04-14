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
DEPLOY_DIR="$(mktemp -d)"
cleanup() {
	git worktree remove "${DEPLOY_DIR}" --force >/dev/null 2>&1 || true
}
trap cleanup EXIT

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

rm -rf "${DEPLOY_DIR}"/* "${DEPLOY_DIR}"/.[!.]* "${DEPLOY_DIR}"/..?* 2>/dev/null || true
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