import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@metamask')) {
            return 'metamask';
          }

          if (id.includes('@reown')) {
            return 'appkit';
          }

          if (id.includes('@walletconnect')) {
            return 'walletconnect';
          }

          if (id.includes('wagmi') || id.includes('viem') || id.includes('ethers')) {
            return 'web3-core';
          }

          if (id.includes('react-router-dom')) {
            return 'router';
          }

          if (id.includes('lucide-react')) {
            return 'ui';
          }

          if (id.includes('zod')) {
            return 'utils';
          }

          if (id.includes('react')) {
            return 'vendor';
          }

          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer-when-downgrade'
    },
    proxy: {
      '/api/payment': {
        target: 'http://127.0.0.1:9000', // اگر PHP را روی 9001 آوردی، اینجا هم 9001 کن
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  }
});

