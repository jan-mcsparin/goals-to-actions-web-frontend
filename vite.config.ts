import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vitest/config'
import { APP_NAME } from './src/config.ts'

const THEME_COLOR = '#2f6f4f'

// Fills %APP_NAME% in index.html so the name stays in src/config.ts only.
function appNameInHtml(): Plugin {
  return {
    name: 'app-name-in-html',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    appNameInHtml(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Plans each day so life keeps running, goals move forward, and free time stays protected.',
        theme_color: THEME_COLOR,
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell so the app opens instantly (ADR-004).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
