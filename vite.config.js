import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['golf-icon.svg'],
      manifest: {
        name: 'Golf Stableford',
        short_name: 'Golf',
        description: 'Track your Stableford score hole by hole',
        theme_color: '#166534',
        background_color: '#166534',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'golf-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}']
      }
    })
  ]
})
