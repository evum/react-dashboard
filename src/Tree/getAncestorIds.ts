import type { OrganizationNode } from '@/api/GetOrganizationStructure';

const findAncestorIds = (
    nodes: OrganizationNode[],
    id: string
): string[] | null => {
    for (const node of nodes) {
        if (node.id === id) {
            return [];
        }

        const nested = findAncestorIds(node.children, id);

        if (nested) {
            return [node.id, ...nested];
        }
    }

    return null;
};

const getAncestorIds = (nodes: OrganizationNode[], id: string): string[] =>
    findAncestorIds(nodes, id) ?? [];

export default getAncestorIds;
