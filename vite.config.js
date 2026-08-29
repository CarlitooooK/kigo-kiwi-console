import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/kigo-kiwi-console/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/kigo': {
        target: 'https://verify-api.kigo.dev',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/kigo/, ''),
      },
    },
  },
})
