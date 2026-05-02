import path from 'node:path';
import type { ServerResponse } from 'node:http';
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
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              const out = res as ServerResponse;
              if (
                out !== undefined &&
                typeof out.writeHead === 'function' &&
                out.headersSent !== true
              ) {
                const payload = {
                  ok: false,
                  code: 'AGENT_CONSOLE_API_UPSTREAM_UNAVAILABLE',
                  message: `控制台 API 未在 127.0.0.1:${String(apiPort)} 监听。请在 apps/agent-console 运行「pnpm dev」以同时启动 Express（API）与 Vite；不要只单独运行 vite。`,
                  cause: err instanceof Error ? err.message : String(err),
                };
                out.writeHead(503, {
                  'Content-Type': 'application/json; charset=utf-8',
                });
                out.end(`${JSON.stringify(payload)}\n`);
              }
            });
          },
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
    // pdfjs-dist ships ESM; pre-bundle caches churn causes "(Outdated Optimize Dep)" / 504 in dev.
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
  };
});
