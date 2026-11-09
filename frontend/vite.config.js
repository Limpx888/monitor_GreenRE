import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Live telemetry WebSockets (e.g. /ws/water-metrics)
      '/ws': {
        target: 'ws://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
      '/api/v1/dashboard': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/v1/demo': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/v1/zones': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/v1/reports': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/v1/telemetry': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
