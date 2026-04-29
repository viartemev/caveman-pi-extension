#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM="$ROOT/vendor/caveman"

if [ ! -d "$UPSTREAM/.git" ] && [ ! -f "$UPSTREAM/.git" ]; then
  echo "Missing upstream submodule. Run: git submodule update --init --recursive" >&2
  exit 1
fi

rm -rf "$ROOT/skills" "$ROOT/caveman-compress"
mkdir -p "$ROOT/skills" "$ROOT/caveman-compress"

cp -R "$UPSTREAM/skills/caveman" \
      "$UPSTREAM/skills/caveman-commit" \
      "$UPSTREAM/skills/caveman-review" \
      "$UPSTREAM/skills/caveman-help" \
      "$ROOT/skills/"

cp "$UPSTREAM/caveman-compress/SKILL.md" "$ROOT/caveman-compress/SKILL.md"
cp -R "$UPSTREAM/caveman-compress/scripts" "$ROOT/caveman-compress/scripts"

[ -f "$UPSTREAM/caveman-compress/README.md" ] && cp "$UPSTREAM/caveman-compress/README.md" "$ROOT/caveman-compress/README.md"
[ -f "$UPSTREAM/caveman-compress/SECURITY.md" ] && cp "$UPSTREAM/caveman-compress/SECURITY.md" "$ROOT/caveman-compress/SECURITY.md"

echo "Synced caveman assets from $UPSTREAM"
