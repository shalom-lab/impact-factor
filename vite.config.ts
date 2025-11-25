import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH ?? '/';

  return {
    base,
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: 'data/**/*',
            dest: 'data'
          }
        ]
      })
    ],
    server: {
      port: 5173,
      host: '0.0.0.0'
    }
  };
});

