#!/usr/bin/env bun
// Incrémente ?v=XX dans tous les fichiers frontend (HTML + JS)
// Usage : bun run bump-version

const publicDir = 'src/public'

// 1. Trouver la version actuelle dans index.html
const indexHtml = await Bun.file(`${publicDir}/index.html`).text()
const match = indexHtml.match(/\?v=(\d+)/)
if (!match) { console.error('❌ Aucun ?v=XX trouvé dans index.html'); process.exit(1) }

const currentV = parseInt(match[1])
const newV = currentV + 1

// Remplace TOUS les ?v=N après .js ou .css (quelle que soit la version)
// Le lookbehind assure qu'on ne touche que les URLs d'assets, jamais du contenu arbitraire
const assetVersionRe = /(?<=\.(js|css))\?v=\d+/g
const replacement = `?v=${newV}`

// 2. Remplacer dans tous les .html, .js et .css du dossier public
const files = Array.from(new Bun.Glob('**/*.{html,js,css}').scanSync(publicDir))

let countFiles = 0
let countOccurrences = 0
for (const rel of files) {
  const path = `${publicDir}/${rel}`
  const content = await Bun.file(path).text()
  const matches = content.match(assetVersionRe)
  if (matches) {
    await Bun.write(path, content.replaceAll(assetVersionRe, replacement))
    countFiles++
    countOccurrences += matches.length
  }
}

console.log(`✅ → v${newV} (${countFiles} fichiers, ${countOccurrences} occurrences mis à jour)`)
