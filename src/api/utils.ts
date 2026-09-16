const MAX_POLL_INTERVAL = 900_000 as const;

type OrganizationNode = {
    id: string;
    name: string;
    parentId: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: string;
    children: OrganizationNode[];
};

type OrganizationStructure = {
    version: number;
    nodes: OrganizationNode[];
};

type OrganizationNodePatch = {
    id: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: string;
};

type OrganizationChanges = {
    version: number;
    changed: OrganizationNodePatch[];
    reset: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const parseUpdatedAt = (value: unknown): string => {
    const updatedAt = value instanceof Date ? value.toISOString() : value;

    if (
        typeof updatedAt !== 'string' ||
        Number.isNaN(new Date(updatedAt).getTime())
    ) {
        throw new Error('OrganizationNode updatedAt must be a valid date');
    }

    return updatedAt;
};

const parseOrganizationNode = (value: unknown): OrganizationNode => {
    if (!isRecord(value)) {
        throw new Error('OrganizationNode must be an object');
    }

    const {
        id,
        name,
        parentId,
        headcount,
        budget,
        performance,
        updatedAt,
        children
    } = value;

    if (
        typeof id !== 'string' ||
        typeof name !== 'string' ||
        typeof parentId !== 'string'
    ) {
        throw new Error(
            'OrganizationNode id, name and parentId must be strings'
        );
    }

    if (
        !isFiniteNumber(headcount) ||
        !isFiniteNumber(budget) ||
        !isFiniteNumber(performance)
    ) {
        throw new Error(
            'OrganizationNode headcount, budget and performance must be finite numbers'
        );
    }

    if (!Array.isArray(children)) {
        throw new Error('OrganizationNode children must be an array');
    }

    return {
        id,
        name,
        parentId,
        headcount,
        budget,
        performance,
        updatedAt: parseUpdatedAt(updatedAt),
        children: children.map(parseOrganizationNode)
    };
};

const parseOrganizationStructure = (value: unknown): OrganizationStructure => {
    if (!isRecord(value) || !isFiniteNumber(value.version)) {
        throw new Error('Org tree response must contain a numeric version');
    }

    if (!Array.isArray(value.nodes)) {
        throw new Error('Org tree response must contain a nodes array');
    }

    return {
        version: value.version,
        nodes: value.nodes.map(parseOrganizationNode)
    };
};

const fetchJson = async (url: string): Promise<unknown> => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
    }

    try {
        return await response.json();
    } catch (error) {
        throw new Error(`Failed to load ${url}: ${error}`);
    }
};

const patchNodes = (
    nodes: OrganizationNode[],
    patches: Map<string, OrganizationNodePatch>
): OrganizationNode[] => {
    let touched = false;

    const next = nodes.map((node) => {
        const patch = patches.get(node.id);
        const children = patchNodes(node.children, patches);

        if (!patch && children === node.children) {
            return node;
        }

        touched = true;

        return patch
            ? {
                  ...node,
                  headcount: patch.headcount,
                  budget: patch.budget,
                  performance: patch.performance,
                  updatedAt: patch.updatedAt,
                  children
              }
            : { ...node, children };
    });

    return touched ? next : nodes;
};

const getPollInterval = (base: number, failureCount: number) =>
    Math.min(base * 2 ** failureCount, MAX_POLL_INTERVAL) +
    Math.random() * base * 0.1;

const parseOrganizationNodePatch = (value: unknown): OrganizationNodePatch => {
    if (!isRecord(value)) {
        throw new Error('OrganizationNodePatch must be an object');
    }

    const { id, headcount, budget, performance, updatedAt } = value;

    if (typeof id !== 'string') {
        throw new Error('OrganizationNodePatch id must be a string');
    }

    if (
        !isFiniteNumber(headcount) ||
        !isFiniteNumber(budget) ||
        !isFiniteNumber(performance)
    ) {
        throw new Error(
            'OrganizationNodePatch headcount, budget and performance must be finite numbers'
        );
    }

    return {
        id,
        headcount,
        budget,
        performance,
        updatedAt: parseUpdatedAt(updatedAt)
    };
};

const parseOrganizationChanges = (value: unknown): OrganizationChanges => {
    if (!isRecord(value) || !isFiniteNumber(value.version)) {
        throw new Error('Changes response must contain a numeric version');
    }

    if (value.reset === true) {
        return { version: value.version, changed: [], reset: true };
    }

    if (!Array.isArray(value.changed)) {
        throw new Error('Changes response must contain a changed array');
    }

    return {
        version: value.version,
        changed: value.changed.map(parseOrganizationNodePatch),
        reset: false
    };
};

const applyOrganizationChanges = (
    structure: OrganizationStructure,
    changes: OrganizationChanges
): OrganizationStructure => ({
    version: changes.version,
    nodes: patchNodes(
        structure.nodes,
        new Map(changes.changed.map((patch) => [patch.id, patch]))
    )
});

export {
    fetchJson,
    parseOrganizationStructure,
    patchNodes,
    getPollInterval,
    isRecord,
    isFiniteNumber,
    parseUpdatedAt,
    parseOrganizationChanges,
    applyOrganizationChanges
};
export type {
    OrganizationNode,
    OrganizationStructure,
    OrganizationNodePatch,
    OrganizationChanges
};
