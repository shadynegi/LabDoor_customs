import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bundle analyzer - run with: npm run build -- --analyze
const analyzeBundle = process.env.ANALYZE === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Add visualizer for bundle analysis when ANALYZE=true
    analyzeBundle && (await import('rollup-plugin-visualizer')).visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // Options: 'treemap', 'sunburst', 'network'
    }),
  ].filter(Boolean),
  server: {
    host: true,   // exposes dev server to your LAN
    port: 5173,
  },
  // Build optimization for 1000+ concurrent users
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
          'framer-motion': ['framer-motion'],
          'liquid-web': ['liquid-web'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
    // Disable source maps in production
    sourcemap: false,
    // Minification settings
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Report compressed sizes
    reportCompressedSize: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react'],
  },
  // Define for dead code elimination
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})
