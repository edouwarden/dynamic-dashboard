#!/bin/sh
# Build the static demo into demo-static/public without Node.
#
# Usage: sh demo-static/build.sh
#
# Same output as build.mjs. Used by Cloudflare Workers/Vercel so the deploy
# needs no runtime beyond a POSIX shell.

set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(dirname -- "$here")
out="$here/public"
skip_dirs=".backups .sessions .opencode uploads node_modules"

if [ ! -f "$here/data/seed.json" ]; then
  echo "Missing demo-static/data/seed.json — run 'bun demo-static/tools/generate-data.mjs' first." >&2
  exit 1
fi

rm -rf "$out"
mkdir -p "$out"

# --- Static shell ---
cp -R "$repo_root/src/public/static" "$out/static"
cp "$repo_root/src/public/manifest.json" "$out/manifest.json"

# Keep app.js happy and purge any cache left by an older deployment.
cat > "$out/sw.js" <<'EOF'
// Static demo: no offline cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
EOF

# --- IndexedDB engine + shims ---
mkdir -p "$out/demo"
for file in engine.js shell.js widget-bridge.js; do
  cp "$here/src/$file" "$out/demo/$file"
done

# --- Seed data ---
mkdir -p "$out/site-data"
cp "$here/data/seed.json" "$out/site-data/seed.json"

# --- Shell HTML ---
sed -e 's|<html lang="fr">|<html lang="en">|' \
    -e 's|<title>Dashboard</title>|<title>Dashboard — Static demo</title>|' \
    -e 's|<head>|<head>\n  <script>window.DEMO_MODE = true;</script>|' \
    -e 's|<script type="module" src="/static/js/app.js|<script type="module" src="/demo/shell.js?v=2"></script>\n  <script type="module" src="/static/js/app.js|' \
    "$repo_root/src/public/index.html" > "$out/index.html"

# The static build cannot execute scripts, so drop the Scripts entry point
# from the markup instead of only hiding it after the shell loads.
sed -i '/<div class="sidebar-footer">/,/<\/div>/d' "$out/index.html"

# --- Widgets ---
mkdir -p "$out/widgets"
count=0
for source in "$repo_root"/data/widgets/*/; do
  [ -d "$source" ] || continue
  id=$(basename -- "$source")
  case " $skip_dirs " in
    *" $id "*) continue ;;
  esac
  [ -f "$source/index.html" ] || continue

  target="$out/widgets/$id"
  cp -R "$source" "$target"
  for skip in $skip_dirs; do
    rm -rf "$target/$skip"
  done

  page="$target/index.html"
  if ! grep -q 'widget-bridge.js' "$page"; then
    if grep -qi '<head' "$page"; then
      sed -i '0,/<head[^>]*>/s//&\n  <script src="\/demo\/widget-bridge.js"><\/script>/' "$page"
    else
      printf '%s\n' '<script src="/demo/widget-bridge.js"></script>' | cat - "$page" > "$page.tmp"
      mv "$page.tmp" "$page"
    fi
  fi
  count=$((count + 1))
done

size() {
  if [ -f "$1" ]; then
    wc -c < "$1" | awk '{ printf "%.1f kB", $1 / 1024 }'
  else
    printf '0.0 kB'
  fi
}

echo "Static demo built in $out"
echo "  index.html     $(size "$out/index.html")"
echo "  seed.json      $(size "$out/site-data/seed.json")"
echo "  widgets        $count"
