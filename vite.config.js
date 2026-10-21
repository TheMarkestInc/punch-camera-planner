import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/punch-camera-planner/',
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
});
