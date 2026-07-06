import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend talks to the Django API. In dev we proxy /api -> :8000 so there
// are no CORS concerns and the base URL stays relative. Override the target
// with VITE_API_PROXY if the backend runs elsewhere.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // The recharts + d3 vendor chunk is inherently large; it's isolated below so
    // it caches independently of the app code. Raise the warning past its size.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor libraries into their own long-cacheable chunks so the app
        // code (which changes far more often) stays small and users don't
        // re-download React / the charting library on every deploy.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](react|react-dom|scheduler|react-is)[\\/]/.test(id)) return 'react'
          return 'vendor' // recharts, d3, everything else
        },
      },
    },
  },
})
