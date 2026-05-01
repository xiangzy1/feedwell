import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default {
  root: resolve('src/renderer-stats'),
  build: {
    outDir: resolve('out/renderer-stats'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer-stats/index.html')
    }
  },
  plugins: [react()]
}
