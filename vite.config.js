import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootAssetsDir = path.resolve(__dirname, 'assets');

function serveRootAssets() {
  return {
    name: 'serve-root-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url || '').split('?')[0]);
        const filePath = path.resolve(rootAssetsDir, `.${urlPath}`);

        if (!filePath.startsWith(rootAssetsDir) || !existsSync(filePath)) {
          next();
          return;
        }

        const stat = statSync(filePath);
        if (!stat.isFile()) {
          next();
          return;
        }

        createReadStream(filePath).pipe(res);
      });
    }
  };
}

// GH Pages serves the site under https://<user>.github.io/<repo>/, so all
// relative asset URLs must be prefixed. Pass VITE_BASE at build time to
// control this (default `/` works for Vercel and custom domains).
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  root: 'app',
  base,
  publicDir: false,
  plugins: [serveRootAssets()],
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: [__dirname]
    }
  },
  build: {
    target: 'esnext',
    outDir: '../dist',
    emptyOutDir: true
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
});
