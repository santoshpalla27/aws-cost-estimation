import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@schemas': path.resolve(__dirname, './src/schemas'),
            '@engine': path.resolve(__dirname, './src/engine'),
            '@ui': path.resolve(__dirname, './src/ui'),
            '@types': path.resolve(__dirname, './src/types'),
            '@pricing': path.resolve(__dirname, './public/pricing'),
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'pricing-data': ['/public/pricing/**/*.json'],
                },
            },
        },
    },
    server: {
        port: 3000,
        open: true,
    },
});
