import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/kigo-kiwi-console/',
  plugins: [react()],
  server: {
    port: 5173,
  },
})
