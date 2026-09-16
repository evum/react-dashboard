import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envInt = (name, fallback) => {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const PORT = envInt('PORT', envInt('SERVER_PORT', 3000));
const HOST = process.env.HOST ?? '0.0.0.0';
const CHANGE_INTERVAL = envInt('CHANGE_INTERVAL', 4000);
const MAX_CHANGED_NODES = envInt('MAX_CHANGED_NODES', 3);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const ORG_TREE_PATH =
    process.env.ORG_TREE_PATH ??
    join(dirname(fileURLToPath(import.meta.url)), '../mock/org-tree.json');

const flattenNodes = (nodes) =>
    nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);

const jitterAround = (base, spread) =>
    Math.round(base * (1 + (Math.random() - 0.5) * spread));

const nodes = JSON.parse(readFileSync(ORG_TREE_PATH, 'utf8'));
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
const nodeVersions = new Map();
let version = 0;

const changeRandomNodes = () => {
    version += 1;

    const count = 1 + Math.floor(Math.random() * MAX_CHANGED_NODES);

    for (let i = 0; i < count; i += 1) {
        const node = flatNodes[Math.floor(Math.random() * flatNodes.length)];
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

const sendJson = (res, status, body, extraHeaders = {}) => {
    for (const [name, value] of Object.entries(extraHeaders)) {
        res.setHeader(name, value);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(status);
    res.end(JSON.stringify(body));
};

const setCors = (res) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'If-None-Match, Content-Type'
    );
    res.setHeader('Access-Control-Expose-Headers', 'ETag');
};

const server = createServer((req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
    }

    const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`
    );

    if (url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
        return;
    }

    if (url.pathname === '/api/org-tree/changes') {
        const since = Number(url.searchParams.get('since'));

        res.setHeader('Cache-Control', 'no-store');

        if (!Number.isFinite(since) || since > version) {
            sendJson(res, 200, { version, changed: [], reset: true });
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

        sendJson(res, 200, { version, changed });
        return;
    }

    if (url.pathname === '/api/org-tree') {
        const body = JSON.stringify({ version, nodes });
        const etag = `"${createHash('sha1').update(body).digest('base64')}"`;

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('ETag', etag);

        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304);
            res.end();
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(body);
        return;
    }

    res.writeHead(404);
    res.end();
});

if (CHANGE_INTERVAL > 0) {
    const timer = setInterval(changeRandomNodes, CHANGE_INTERVAL);

    server.on('close', () => clearInterval(timer));
}

server.listen(PORT, HOST, () => {
    console.log(`org-tree API on http://${HOST}:${PORT}`);
});
