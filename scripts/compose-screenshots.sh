#!/usr/bin/env bash
# Builds a marketing-style composite for every screenshot that exists in both
# docs/screenshots/desktop/ and docs/screenshots/mobile/: the desktop shot in a
# browser frame, with the mobile shot in a phone frame overlapping its corner.
#
#   ./scripts/compose-screenshots.sh [name ...]
#
# Output goes to docs/screenshots/composite/<name>.png on a transparent
# background, so it reads correctly in both GitHub light and dark themes.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC_DESKTOP="docs/screenshots/desktop"
SRC_MOBILE="docs/screenshots/mobile"
OUT="docs/screenshots/composite"

command -v magick >/dev/null 2>&1 || { echo "ImageMagick (magick) is required." >&2; exit 1; }
mkdir -p "$OUT"

# --- Geometry (in pixels of the working canvas) ------------------------------
DESK_W=1600            # width of the browser frame's screen area (native capture width)
OUT_W=1600             # width of the finished composite
BAR_H=70               # browser title bar
RADIUS=19              # browser frame corner radius
CHROME='#2c2c31'       # title bar colour
BEZEL=23               # phone bezel thickness
PHONE_RADIUS=88        # phone outer corner radius
PHONE_BODY='#17171a'   # phone bezel colour
PHONE_RATIO=0.82       # phone height as a fraction of the browser frame height
PHONE_OVERLAP=0.45     # fraction of the phone width sitting over the browser frame
OVERHANG=0.12          # fraction of the phone hanging below the browser frame
SHADOW='60x27+0+15'    # opacity x sigma + offset

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

compose_one() {
  local name="$1"
  local d="$SRC_DESKTOP/$name.png"
  local m="$SRC_MOBILE/$name.png"

  # --- Browser frame ---------------------------------------------------------
  local dh
  dh=$(magick "$d" -resize "${DESK_W}x" -format '%h' info:)
  local frame_h=$((BAR_H + dh))

  # Title bar: rounded on top, square at the bottom where the page starts.
  magick -size "${DESK_W}x${BAR_H}" xc:none \
    -fill "$CHROME" -draw "roundrectangle 0,0 $((DESK_W - 1)),$((BAR_H + RADIUS)) $RADIUS,$RADIUS" \
    -fill '#ff5f57' -draw "circle 35,$((BAR_H / 2)) 35,$((BAR_H / 2 - 10))" \
    -fill '#febc2e' -draw "circle 67,$((BAR_H / 2)) 67,$((BAR_H / 2 - 10))" \
    -fill '#28c840' -draw "circle 99,$((BAR_H / 2)) 99,$((BAR_H / 2 - 10))" \
    -fill '#45454c' -draw "roundrectangle $((DESK_W / 2 - 173)),$((BAR_H / 2 - 15)) $((DESK_W / 2 + 173)),$((BAR_H / 2 + 15)) 15,15" \
    "$tmp/bar.png"

  # Page + bar stacked, then the whole block clipped to rounded corners.
  magick "$d" -resize "${DESK_W}x" "$tmp/page.png"
  magick "$tmp/bar.png" "$tmp/page.png" -append "$tmp/stack.png"
  magick -size "${DESK_W}x${frame_h}" xc:none \
    -fill white -draw "roundrectangle 0,0 $((DESK_W - 1)),$((frame_h - 1)) $RADIUS,$RADIUS" \
    "$tmp/dmask.png"
  magick "$tmp/stack.png" "$tmp/dmask.png" -alpha off -compose CopyOpacity -composite "$tmp/browser.png"

  # --- Phone frame -----------------------------------------------------------
  local phone_screen_h phone_screen_w phone_w phone_h
  phone_screen_h=$(python3 -c "print(int($frame_h * $PHONE_RATIO) - 2 * $BEZEL)")
  phone_screen_w=$(magick "$m" -resize "x${phone_screen_h}" -format '%w' info:)
  phone_w=$((phone_screen_w + 2 * BEZEL))
  phone_h=$((phone_screen_h + 2 * BEZEL))

  magick "$m" -resize "x${phone_screen_h}" "$tmp/mscreen.png"

  # Bezel body, screen pasted inside, dynamic island on top.
  magick -size "${phone_w}x${phone_h}" xc:none \
    -fill "$PHONE_BODY" -draw "roundrectangle 0,0 $((phone_w - 1)),$((phone_h - 1)) $PHONE_RADIUS,$PHONE_RADIUS" \
    "$tmp/pbody.png"
  magick -size "${phone_screen_w}x${phone_screen_h}" xc:none \
    -fill white -draw "roundrectangle 0,0 $((phone_screen_w - 1)),$((phone_screen_h - 1)) $((PHONE_RADIUS - BEZEL)),$((PHONE_RADIUS - BEZEL))" \
    "$tmp/pmask.png"
  magick "$tmp/mscreen.png" "$tmp/pmask.png" -alpha off -compose CopyOpacity -composite "$tmp/pscreen.png"
  # No notch or dynamic island on purpose: pages render content from y=0, so an
  # island would sit on top of every page title.
  magick "$tmp/pbody.png" "$tmp/pscreen.png" -geometry "+${BEZEL}+${BEZEL}" -compose over -composite \
    "$tmp/phone.png"

  # --- Shadows ---------------------------------------------------------------
  magick "$tmp/browser.png" \( +clone -background black -shadow "$SHADOW" \) \
    +swap -background none -layers merge +repage "$tmp/browser_s.png"
  magick "$tmp/phone.png" \( +clone -background black -shadow "$SHADOW" \) \
    +swap -background none -layers merge +repage "$tmp/phone_s.png"

  # --- Layout ----------------------------------------------------------------
  # The phone sits at the right edge, hanging below the browser frame.
  local bw bh pw ph canvas_w canvas_h px py
  bw=$(magick "$tmp/browser_s.png" -format '%w' info:)
  bh=$(magick "$tmp/browser_s.png" -format '%h' info:)
  pw=$(magick "$tmp/phone_s.png" -format '%w' info:)
  ph=$(magick "$tmp/phone_s.png" -format '%h' info:)

  local drop
  drop=$(python3 -c "print(int($ph * $OVERHANG))")
  canvas_w=$(python3 -c "print($bw + int($pw * (1 - $PHONE_OVERLAP)))")
  canvas_h=$(python3 -c "print(max($bh, int(($bh - $ph) / 2) + $ph + $drop))")

  px=$((canvas_w - pw))
  py=$(python3 -c "print(int(($bh - $ph) / 2) + $drop)")

  magick -size "${canvas_w}x${canvas_h}" xc:none \
    "$tmp/browser_s.png" -geometry "+0+0" -composite \
    "$tmp/phone_s.png" -geometry "+${px}+${py}" -composite \
    -trim +repage \
    -resize "${OUT_W}x" \
    -strip -define png:compression-level=9 \
    "$OUT/$name.png"

  printf '%-28s %s\n' "$name" "$(magick "$OUT/$name.png" -format '%wx%h' info:)"
}

if [ $# -gt 0 ]; then
  names=("$@")
else
  mapfile -t names < <(comm -12 \
    <(cd "$SRC_DESKTOP" && ls *.png | sed 's/\.png$//' | sort) \
    <(cd "$SRC_MOBILE" && ls *.png | sed 's/\.png$//' | sort))
fi

for n in "${names[@]}"; do
  if [ ! -f "$SRC_DESKTOP/$n.png" ] || [ ! -f "$SRC_MOBILE/$n.png" ]; then
    echo "skip $n (needs both a desktop and a mobile capture)"
    continue
  fi
  compose_one "$n"
done
