import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import topLevelAwait from 'vite-plugin-top-level-await';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'cad_bridge_vicroads',
      filename: 'remoteEntry.js',
      exposes: {
        './config': './npwd.config.js',
      },
      shared: ['react', 'react-dom'],
    }),
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    }),
  ],
  base: './',
  build: {
    outDir: '../web/dist',
    emptyOutDir: true,
    modulePreload: false,
    assetsDir: '',
    target: 'es2020',
  },
  server: {
    port: 3036,
  },
});
