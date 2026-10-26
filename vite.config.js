// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import geo from 'vite-plugin-geo';

export default defineConfig({
  plugins: [
    react(),
    geo({
      domain: 'https://coloring-studio-theta.vercel.app', // 你的 Vercel 域名
    }),
  ],
});