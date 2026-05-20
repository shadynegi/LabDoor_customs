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
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          // Animation & UI
          if (id.includes('node_modules/framer-motion/')) {
            return 'animation';
          }
          // Icons - separate chunk since it's large
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
          // Utilities
          if (id.includes('node_modules/sonner/') ||
              id.includes('node_modules/react-select/') ||
              id.includes('node_modules/country-list/')) {
            return 'utils';
          }
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
