import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // o three.js sozinho passa dos 500 kB
  build: { chunkSizeWarningLimit: 1600 },
  server: {
    // os programas de exemplo ficam em ../programs
    fs: { allow: ['..'] },
    // em desenvolvimento o backend roda separado (python -m mic1, porta 8765)
    proxy: {
      '/ws': { target: 'ws://localhost:8765', ws: true },
    },
  },
})
