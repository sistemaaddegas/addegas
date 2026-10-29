/**
 * PWA do Addegas (E54, D62). Mesmo padrão do NEXUM-PRO: uma fonte de verdade para a marca,
 * usada pelo manifest, pelo gerador de ícones e pelas telas de abertura do iOS.
 */
export const BRAND = {
  name: 'Addegas',
  description: 'Caixa, estoque, pedidos e fiado da sua adega, no celular, no tablet e no computador.',
  yellow: '#FBC009',
  background: '#0A0A0B',
} as const

/**
 * Telas de abertura do iPhone e do iPad (o iOS não gera a partir do manifest).
 * Uma imagem por tamanho de tela, geradas por `npm run icons`.
 */
export const IOS_SPLASH_SCREENS = [
  { width: 440, height: 956, ratio: 3 }, // iPhone 16/17 Pro Max
  { width: 402, height: 874, ratio: 3 }, // iPhone 16/17 Pro
  { width: 430, height: 932, ratio: 3 }, // iPhone 14 Pro Max a 16 Plus
  { width: 393, height: 852, ratio: 3 }, // iPhone 14 Pro a 16
  { width: 428, height: 926, ratio: 3 }, // iPhone 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // iPhone 12 a 14
  { width: 375, height: 812, ratio: 3 }, // iPhone X, XS, 11 Pro, mini
  { width: 414, height: 896, ratio: 3 }, // iPhone XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // iPhone XR, 11
  { width: 375, height: 667, ratio: 2 }, // iPhone SE, 8
  { width: 820, height: 1180, ratio: 2 }, // iPad Air, iPad 10 (tablet do balcão)
  { width: 834, height: 1194, ratio: 2 }, // iPad Pro 11
  { width: 1024, height: 1366, ratio: 2 }, // iPad Pro 12.9
] as const

export function splashFileName(screen: { width: number; height: number; ratio: number }) {
  return `splash-${screen.width * screen.ratio}x${screen.height * screen.ratio}.png`
}

/** <link rel="apple-touch-startup-image"> de cada tela, em retrato. */
export function splashLinks(): string {
  return IOS_SPLASH_SCREENS.map((s) =>
    `<link rel="apple-touch-startup-image" href="/splash/${splashFileName(s)}" media="(device-width: ${s.width}px) and (device-height: ${s.height}px) and (-webkit-device-pixel-ratio: ${s.ratio}) and (orientation: portrait)" />`,
  ).join('\n    ')
}
