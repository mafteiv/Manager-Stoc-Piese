import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Asigură că toate link-urile din build sunt relative, esențial pentru GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})