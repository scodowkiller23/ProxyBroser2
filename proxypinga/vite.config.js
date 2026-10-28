import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  // Marca de compilacion, para saber de un vistazo si el navegador tiene la version nueva.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')) },
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://localhost:8099',
      '/scram': 'http://localhost:8099',
      '/baremux': 'http://localhost:8099',
      '/libcurl': 'http://localhost:8099',
      '/wisp/': { target: 'ws://localhost:8099', ws: true },
    },
  },
});
