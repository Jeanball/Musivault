import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Ensure VERSION file is served as a static asset
  assetsInclude: ['**/VERSION'],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router', 'react-cookie'],
          'ui-vendor': ['lucide-react', 'react-toastify', 'html5-qrcode'],
          'i18n-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector']
        }
      }
    }
  }
})



