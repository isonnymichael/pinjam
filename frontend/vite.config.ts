import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/plume-api': {
        target: 'https://portal-api.plume.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/plume-api/, '/api/v1'),
      }
    }
  }
})
