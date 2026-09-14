import { useQuery } from '@tanstack/react-query';

const STALE_TIME = 5000 as const;

type OrgNode = {
    id: string;
    name: string;
    parentId: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: Date;
    children: OrgNode[];
};

const orgTreeQueryKey = ['org-tree'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const parseUpdatedAt = (value: unknown): Date => {
    const date =
        value instanceof Date
            ? value
            : new Date(typeof value === 'string' ? value : '');

    if (Number.isNaN(date.getTime())) {
        throw new Error('OrgNode updatedAt must be a valid date');
    }

    return date;
};

const parseOrgNode = (value: unknown): OrgNode => {
    if (!isRecord(value)) {
        throw new Error('OrgNode must be an object');
    }

    const {
        id,
        name,
        parentId,
        headcount,
        budget,
        performance,
        updatedAt,
        children,
    } = value;

    if (
        typeof id !== 'string' ||
        typeof name !== 'string' ||
        typeof parentId !== 'string'
    ) {
        throw new Error('OrgNode id, name and parentId must be strings');
    }

    if (
        !isFiniteNumber(headcount) ||
        !isFiniteNumber(budget) ||
        !isFiniteNumber(performance)
    ) {
        throw new Error(
            'OrgNode headcount, budget and performance must be finite numbers',
        );
    }

    if (!Array.isArray(children)) {
        throw new Error('OrgNode children must be an array');
    }

    return {
        id,
        name,
        parentId,
        headcount,
        budget,
        performance,
        updatedAt: parseUpdatedAt(updatedAt),
        children: children.map(parseOrgNode),
    };
};

const parseOrgTree = (value: unknown): OrgNode[] => {
    if (!Array.isArray(value)) {
        throw new Error('Org tree must be an array of OrgNode');
    }

    return value.map(parseOrgNode);
};

const getOrgTree = async (): Promise<OrgNode[]> => {
    const response = await fetch('/api/org-tree');

    if (!response.ok) {
        throw new Error(`Failed to load org tree: ${response.status}`);
    }

    let data: unknown;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error(`Failed to load org tree: ${error}`);
    }

    return parseOrgTree(data);
};

const useOrgTree = () =>
    useQuery({
        queryKey: orgTreeQueryKey,
        queryFn: getOrgTree,
        staleTime: STALE_TIME,
    });

export { useOrgTree, getOrgTree, orgTreeQueryKey, type OrgNode };
