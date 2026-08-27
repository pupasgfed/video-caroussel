import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En local, base = '/'. Sur GitHub Pages, le workflow passe --base='/NOM_REPO/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
