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
        },
        '/ws': {
          target: `ws://localhost:${dashboardPort}`,
          ws: true,
          changeOrigin: true,
          // A browser always sends an Origin on a WebSocket handshake (unlike a
          // same-origin fetch, which sends none), and the dashboard's CORS only
          // allows its own origin and the Vite default port. Rewrite the proxied
          // Origin to the dashboard's own so a dev frontend on any port connects.
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


