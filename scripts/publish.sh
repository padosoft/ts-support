#!/usr/bin/env bash
# Publishes each package to npm using `bun pm pack` so that workspace:^
# dependencies are resolved to real semver versions before publishing.
# `changeset publish` uses npm pack internally which ships workspace: as-is.
set -euo pipefail

for dir in packages/*/; do
  [ -f "${dir}package.json" ] || continue

  name=$(jq -r '.name' "${dir}package.json")
  version=$(jq -r '.version' "${dir}package.json")
  private=$(jq -r '.private // "false"' "${dir}package.json")

  [ "$private" = "true" ] && continue

  if npm view "${name}@${version}" version &>/dev/null 2>&1; then
    echo "Already published: ${name}@${version} — skipping"
    continue
  fi

  echo "Packing ${name}@${version} via bun pm pack..."
  pushd "$dir" > /dev/null
  tarball="$(bun pm pack 2>&1 | grep -Eo '[^[:space:]]+\.tgz$' | tail -1 || true)"
  if [ -z "$tarball" ] || [ ! -f "$tarball" ]; then
    echo "Failed to determine tarball path from bun pm pack output for ${name}@${version}" >&2
    exit 1
  fi
  echo "Publishing ${tarball}..."
  npm publish "$tarball" --access public
  rm -f "$tarball"
  popd > /dev/null
done

# Create git tags for all published packages (equivalent to what changeset publish does)
changeset tag
