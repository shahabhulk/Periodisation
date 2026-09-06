import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      '/lyfta-api': {
        target: 'https://my.lyfta.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lyfta-api/, ''),
      },
    },
  },
})
