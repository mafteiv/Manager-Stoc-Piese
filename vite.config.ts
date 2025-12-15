import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Manager-Stoc-Piese/', // Pentru GitHub Pages: /<nume-repository>/
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
