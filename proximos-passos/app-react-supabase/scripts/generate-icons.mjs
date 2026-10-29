/**
 * Gera os ícones do PWA e as telas de abertura do iOS a partir do "dd" amarelo (E54).
 * Uso: npm run icons
 *
 * Ícone: "dd" sobre o fundo escuro da marca. Ícone maskable com margem de segurança de 20%,
 * para o Android poder recortar em círculo sem cortar o símbolo. Saídas versionadas em public/.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(root, 'public/icons/dd-amarelo.png')
const BACKGROUND = '#0A0A0B'

// Mesmas medidas de src/lib/pwa.ts (IOS_SPLASH_SCREENS).
const SPLASH_SCREENS = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [375, 667, 2], [820, 1180, 2], [834, 1194, 2], [1024, 1366, 2],
]

/** Símbolo centralizado num quadrado de `size`, ocupando `scale` da largura. */
async function icon(size, scale, file) {
  const mark = await sharp(SOURCE).resize({ width: Math.round(size * scale), height: Math.round(size * scale), fit: 'inside' }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, 'public/icons', file))
}

async function splash(w, h, ratio) {
  const width = w * ratio
  const height = h * ratio
  const markSize = Math.round(Math.min(width, height) * 0.32)
  const mark = await sharp(SOURCE).resize({ width: markSize, height: markSize, fit: 'inside' }).toBuffer()
  await sharp({ create: { width, height, channels: 4, background: BACKGROUND } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, 'public/splash', `splash-${width}x${height}.png`))
}

await mkdir(path.join(root, 'public/splash'), { recursive: true })
await icon(192, 0.72, 'icon-192.png')
await icon(512, 0.72, 'icon-512.png')
await icon(192, 0.6, 'icon-maskable-192.png') // 20% de margem em cada lado
await icon(512, 0.6, 'icon-maskable-512.png')
await icon(180, 0.72, 'apple-touch-icon.png')
await icon(32, 0.8, 'favicon-32.png')
for (const [w, h, r] of SPLASH_SCREENS) await splash(w, h, r)
console.log(`Ícones e ${SPLASH_SCREENS.length} telas de abertura gerados em public/.`)
