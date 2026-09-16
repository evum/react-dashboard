import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const distDir = fileURLToPath(new URL('./dist', import.meta.url));
const MAX_GZIP_BYTES = 200 * 1024;

const collectFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);

        return statSync(path).isDirectory() ? collectFiles(path) : [path];
    });

const gzipBudget = (): Plugin => ({
    name: 'gzip-budget',
    apply: 'build',
    closeBundle() {
        const total = collectFiles(distDir).reduce(
            (sum, file) => sum + gzipSync(readFileSync(file)).length,
            0
        );

        if (total > MAX_GZIP_BYTES) {
            throw new Error(
                `gzip build is ${(total / 1024).toFixed(1)} KB; limit is 200 KB`
            );
        }
    }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiUrl = env.API_URL || 'http://127.0.0.1:3000';
    const clientHost = env.CLIENT_HOST || '127.0.0.1';
    const clientPort = Number(env.VITE_PORT) || 5173;

    return {
        plugins: [react(), gzipBudget()],
        resolve: {
            alias: {
                '@': srcDir
            }
        },
        server: {
            host: clientHost,
            port: clientPort,
            proxy: {
                '/api': apiUrl
            }
        },
        preview: {
            host: clientHost,
            port: clientPort,
            proxy: {
                '/api': apiUrl
            }
        }
    };
});
