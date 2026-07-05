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
})
