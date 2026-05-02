import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, '');
  const apiPort = Number(env.AGENT_CONSOLE_API_PORT ?? '5280');
  const vitePort = Number(env.AGENT_CONSOLE_VITE_PORT ?? '5275');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '~': path.resolve(dirname, './src'),
      },
    },
    root: dirname,
    server: {
      port: vitePort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${String(apiPort)}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: vitePort + 100,
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      sourcemap: true,
    },
  };
});
