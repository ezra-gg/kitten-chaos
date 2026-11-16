import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so a production build can be served from any subfolder.
  base: './',
  server: {
    // Open the browser automatically when someone runs the game.
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
