import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/contentMain.jsx',
      name: 'ExtensionContent',
      formats: ['iife'],
      fileName: () => 'contentMain.js'
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
