import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load projects config at build time
const projectsPath = resolve(__dirname, 'projects.json');
let projects = [];
try {
  const raw = readFileSync(projectsPath, 'utf-8');
  projects = JSON.parse(raw).projects || [];
} catch (e) {
  console.warn('No projects.json found, building with empty projects');
}

export default defineConfig({
  plugins: [react()],
  define: {
    __PROJECTS__: JSON.stringify(projects),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:9122',
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        ecma: 2020,
        module: true,
      },
      mangle: true,
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) {
            return 'react-dom';
          }
          if (id.includes('node_modules/react/')) {
            return 'react-core';
          }
        },
        chunkFileNames: 'assets/[name]-[hash:8].js',
        entryFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',
      },
    },
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    assetsInlineLimit: 4096,
    cssMinify: 'lightningcss',
  },
  css: {
    transformer: 'lightningcss',
  },
});
