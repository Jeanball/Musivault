#!/usr/bin/env bash
# Losslessly shrink the PNGs under docs/screenshots/ before committing them.
# Strips metadata and re-encodes at maximum compression; pixels are untouched.
set -euo pipefail

cd "$(dirname "$0")/.."
DIR="docs/screenshots"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required." >&2
  exit 1
fi

shopt -s nullglob globstar
files=("$DIR"/**/*.png)

if [ ${#files[@]} -eq 0 ]; then
  echo "No PNG found in $DIR"
  exit 0
fi

total_before=0
total_after=0

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for f in "${files[@]}"; do
  before=$(stat -c%s "$f")
  candidate="$tmp/$(basename "$f")"
  magick "$f" -strip -define png:compression-level=9 -define png:compression-filter=5 "$candidate"
  after=$(stat -c%s "$candidate")

  # Re-encoding does not always win; only keep the result when it is smaller.
  if [ "$after" -lt "$before" ]; then
    mv "$candidate" "$f"
    printf '%-56s %6s KB -> %6s KB\n' "$f" "$((before / 1024))" "$((after / 1024))"
  else
    after=$before
    printf '%-56s %6s KB    (kept)\n' "$f" "$((before / 1024))"
  fi

  total_before=$((total_before + before))
  total_after=$((total_after + after))
done

echo
printf 'Total: %s KB -> %s KB\n' "$((total_before / 1024))" "$((total_after / 1024))"
