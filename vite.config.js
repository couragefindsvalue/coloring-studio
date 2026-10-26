import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import geo from 'vite-plugin-geo';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    geo({
      domain: 'https://coloring-studio-theta.vercel.app',
    }),
    // 🌟 这是一个自定义插件，用于强制覆盖 sitemap.xml
    {
      name: 'force-custom-sitemap',
      closeBundle() {
        const publicSitemapPath = path.resolve(__dirname, 'public/sitemap.xml');
        const distSitemapPath = path.resolve(__dirname, 'dist/sitemap.xml');

        // 如果 public 里有我们写的 sitemap，就把它覆盖到 dist 里
        if (fs.existsSync(publicSitemapPath)) {
          fs.copyFileSync(publicSitemapPath, distSitemapPath);
          console.log('✅ Custom sitemap.xml successfully overwritten in dist!');
        }
      }
    }
  ],
});