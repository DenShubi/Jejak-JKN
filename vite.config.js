import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base ensures GitHub Pages works seamlessly on any repo subpath (e.g. /JEJAK-JKN/) or custom domain
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 8192
  }
});
