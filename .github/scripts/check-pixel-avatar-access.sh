#!/usr/bin/env bash
# Checks that PIXEL_AVATAR_TOKEN can read the private pixel-avatar repository, and says what to fix when it can't
# (otherwise npm fails later with "Repository not found" or "Permission denied (publickey)").
set -euo pipefail

REPOSITORY="DonatelloDonini/pixel-avatar"
SETUP="Create a fine-grained token with \"Contents: read-only\" on ${REPOSITORY} and save it in this repository's Settings > Secrets and variables > Actions as PIXEL_AVATAR_TOKEN (see the README, \"The pixel-avatar module\")."

if [ -z "${PIXEL_AVATAR_TOKEN:-}" ]; then
  echo "::error title=PIXEL_AVATAR_TOKEN is missing::The PIXEL_AVATAR_TOKEN secret is empty, so npm can't install the private pixel-avatar module. ${SETUP}"
  exit 1
fi

if ! git -c credential.helper= ls-remote "https://x-access-token:${PIXEL_AVATAR_TOKEN}@github.com/${REPOSITORY}.git" HEAD > /dev/null 2>&1; then
  echo "::error title=PIXEL_AVATAR_TOKEN can't read pixel-avatar::The PIXEL_AVATAR_TOKEN secret is set, but it can't read ${REPOSITORY} (expired, or without access to that repository). ${SETUP}"
  exit 1
fi

echo "PIXEL_AVATAR_TOKEN can read ${REPOSITORY}."
