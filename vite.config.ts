import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const orgTreeMockPath = fileURLToPath(
    new URL('./mock/org-tree.json', import.meta.url)
);

const CHANGE_INTERVAL = 4000;
const MAX_CHANGED_NODES = 3;

type MockNode = {
    id: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: string;
    children: MockNode[];
};

const flattenNodes = (nodes: MockNode[]): MockNode[] =>
    nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);

// Отклонение считается от исходного значения, а не от текущего: иначе
// случайное блуждание за несколько минут уводит метрики в единицы.
const jitterAround = (base: number, spread: number) =>
    Math.round(base * (1 + (Math.random() - 0.5) * spread));

const orgTreeMock = (): Plugin => ({
    name: 'org-tree-mock',
    configureServer(server) {
        // Дерево живёт в памяти дев-сервера: изменения генерируются на ходу,
        // поэтому правки mock/org-tree.json подхватываются при перезапуске.
        const nodes: MockNode[] = JSON.parse(
            readFileSync(orgTreeMockPath, 'utf8')
        );
        const flatNodes = flattenNodes(nodes);
        const baseMetrics = new Map(
            flatNodes.map((node) => [
                node.id,
                {
                    headcount: node.headcount,
                    budget: node.budget,
                    performance: node.performance
                }
            ])
        );
        const nodeVersions = new Map<string, number>();
        let version = 0;

        const changeRandomNodes = () => {
            version += 1;

            const count = 1 + Math.floor(Math.random() * MAX_CHANGED_NODES);

            for (let i = 0; i < count; i += 1) {
                const node =
                    flatNodes[Math.floor(Math.random() * flatNodes.length)];
                const base = baseMetrics.get(node.id);

                if (!base) {
                    continue;
                }

                node.headcount = Math.max(1, jitterAround(base.headcount, 0.4));
                node.budget = jitterAround(base.budget, 0.2);
                node.performance = Math.min(
                    100,
                    Math.max(0, jitterAround(base.performance, 0.2))
                );
                node.updatedAt = new Date().toISOString();
                nodeVersions.set(node.id, version);
            }
        };

        const timer = setInterval(changeRandomNodes, CHANGE_INTERVAL);
        server.httpServer?.on('close', () => clearInterval(timer));

        // Регистрируется раньше /api/org-tree: connect сопоставляет по префиксу.
        server.middlewares.use('/api/org-tree/changes', (req, res) => {
            const since = Number(
                new URL(req.url ?? '/', 'http://localhost').searchParams.get(
                    'since'
                )
            );

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');

            // Клиент опережает сервер только если сервер перезапустился —
            // тогда его снимок нельзя чинить патчем, нужен полный рефетч.
            if (!Number.isFinite(since) || since > version) {
                res.end(JSON.stringify({ version, changed: [], reset: true }));
                return;
            }

            const changed = flatNodes
                .filter((node) => (nodeVersions.get(node.id) ?? 0) > since)
                .map(({ id, headcount, budget, performance, updatedAt }) => ({
                    id,
                    headcount,
                    budget,
                    performance,
                    updatedAt
                }));

            res.end(JSON.stringify({ version, changed }));
        });

        server.middlewares.use('/api/org-tree', (req, res) => {
            const body = JSON.stringify({ version, nodes });
            const etag = `"${createHash('sha1').update(body).digest('base64')}"`;

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('ETag', etag);
            // no-cache, а не no-store: браузер обязан ревалидировать, поэтому
            // опрос уходит с If-None-Match и обычно получает пустой 304.
            res.setHeader('Cache-Control', 'no-cache');

            if (req.headers['if-none-match'] === etag) {
                res.statusCode = 304;
                res.end();
                return;
            }

            res.end(body);
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
