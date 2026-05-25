import path from 'path';
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import routify from '@roxi/routify/vite-plugin'

export default defineConfig({
  plugins: [routify(), svelte()],
  resolve: {
    alias: {
      '/src': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
      '/game': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
    }
  }
})
