import { useQuery } from '@tanstack/react-query';

const STALE_TIME = 5000 as const;

type OrganizationNode = {
    id: string;
    name: string;
    parentId: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: Date;
    children: OrganizationNode[];
};

const organizationStructureQueryKey = ['org-tree'] as const;

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
        throw new Error('OrganizationNode updatedAt must be a valid date');
    }

    return date;
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
        children,
    } = value;

    if (
        typeof id !== 'string' ||
        typeof name !== 'string' ||
        typeof parentId !== 'string'
    ) {
        throw new Error(
            'OrganizationNode id, name and parentId must be strings',
        );
    }

    if (
        !isFiniteNumber(headcount) ||
        !isFiniteNumber(budget) ||
        !isFiniteNumber(performance)
    ) {
        throw new Error(
            'OrganizationNode headcount, budget and performance must be finite numbers',
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
        children: children.map(parseOrganizationNode),
    };
};

const parseOrgTree = (value: unknown): OrganizationNode[] => {
    if (!Array.isArray(value)) {
        throw new Error('Org tree must be an array of OrganizationNode');
    }

    return value.map(parseOrganizationNode);
};

const getOrganizationStructure = async (): Promise<OrganizationNode[]> => {
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

const useOrganizationStructure = () =>
    useQuery({
        queryKey: organizationStructureQueryKey,
        queryFn: getOrganizationStructure,
        staleTime: STALE_TIME,
    });

export {
    useOrganizationStructure,
    organizationStructureQueryKey,
    type OrganizationNode,
};
