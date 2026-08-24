import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep the customer bundle small and predictable. The analytics UI uses native
// React/SVG instead of a multi-megabyte chart runtime.
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react'
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
