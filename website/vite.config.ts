import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/StudyMate/' : '/',
  server: { proxy: { '/api': 'http://localhost:5287', '/health': 'http://localhost:5287' } },
}));
