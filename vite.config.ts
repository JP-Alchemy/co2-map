import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    chunkSizeWarningLimit: 1500,
    // MapLibre in a file of its own: it only changes when the library is updated, so browsers keep it cached across deploys
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ }] } } },
  },
  // MapLibre starts its worker as an ES module (see src/map/worker.ts)
  worker: { format: 'es' },
})
