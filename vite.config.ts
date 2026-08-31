import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** GitHub Pages 对未知路径返回 404.html；复制 index 后刷新深链可回到 SPA */
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      const indexHtml = resolve(outDir, 'index.html');
      const notFoundHtml = resolve(outDir, '404.html');
      if (existsSync(indexHtml)) {
        copyFileSync(indexHtml, notFoundHtml);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH ?? '/';

  return {
    base,
    plugins: [react(), spaFallback404()],
    server: {
      port: 5173,
      host: 'localhost'
    }
  };
});
