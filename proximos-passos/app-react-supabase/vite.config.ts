import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { splashLinks } from './src/lib/pwa'

// Telas de abertura do iPhone/iPad no <head> (o iOS não usa o manifest para isso, E54).
const iosSplash = (): Plugin => ({
  name: 'addegas-ios-splash',
  transformIndexHtml: (html) => html.replace('<!-- addegas:splash -->', splashLinks()),
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    iosSplash(),
    VitePWA({
      // Service worker escrito à mão (src/sw.ts), como no NEXUM-PRO; o plugin só injeta a lista do build.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt', // atualização controlada pelo app (nunca no meio de uma venda)
      injectRegister: false,
      manifest: false, // usa public/manifest.webmanifest
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'icons/*.png', 'offline.html'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
})
