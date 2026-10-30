import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import react from '@vitejs/plugin-react';

// Dashboard port - matches DEFAULT_DASHBOARD_PORT in security-utils.ts
// Can be overridden via VITE_DASHBOARD_PORT environment variable
const dashboardPort = process.env.VITE_DASHBOARD_PORT || '5000';

// Dynamically import Tailwind CSS v4 plugin
async function createConfig() {
  const { default: tailwindcss } = await import('@tailwindcss/vite');

  return {
    plugins: [react(), tailwindcss()],
    // Ensure Vite resolves index.html relative to this config file
    root: dirname(fileURLToPath(new URL(import.meta.url))),
    base: '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${dashboardPort}`,
          changeOrigin: true,
          // A browser sends an Origin header on a state-changing fetch (POST,
          // PUT, DELETE) even when it is same-origin, and the dashboard's CORS
          // only allows its own origin and the Vite default port. Rewrite the
          // proxied Origin to the dashboard's own so a dev frontend on any port
          // can still mutate (the WebSocket proxy below does the same for its
          // handshake, which always carries an Origin).
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              proxyReq.setHeader('origin', `http://localhost:${dashboardPort}`);
            });
          },
        },
        '/ws': {
          target: `ws://localhost:${dashboardPort}`,
          ws: true,
          changeOrigin: true,
          configure: (proxy: any) => {
            proxy.on('proxyReqWs', (proxyReq: any) => {
              proxyReq.setHeader('origin', `http://localhost:${dashboardPort}`);
            });
          },
        },
      },
    },
  };
}

export default defineConfig(createConfig());


