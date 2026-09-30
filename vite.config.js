import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /<repo-name>/; Netlify and local dev use the root.
  base: process.env.GITHUB_ACTIONS ? '/regalis-schedule-viewer/' : '/',
});
