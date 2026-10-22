import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained index.html: works on Vercel, any static host, or opened directly.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 },
});
