import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const orgTreeMockPath = fileURLToPath(
    new URL('./mock/org-tree.json', import.meta.url)
);

const orgTreeMock = (): Plugin => ({
    name: 'org-tree-mock',
    configureServer(server) {
        server.middlewares.use('/api/org-tree', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(readFileSync(orgTreeMockPath));
        });
    }
});

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), orgTreeMock()],
    resolve: {
        alias: {
            '@': srcDir
        }
    },
    server: {
        host: '127.0.0.1',
        port: 5173
    }
});
