import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where to forward /api requests. Locally this is the API on localhost; in
// Docker Compose it's the `api` service on the compose network.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the port is reachable from outside the container
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
