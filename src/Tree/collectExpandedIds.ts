import type { OrganizationNode } from '@/api/GetOrganizationStructure';

const DEFAULT_EXPANDED_DEPTH = 2;

const collectExpandedIds = (
    nodes: OrganizationNode[],
    maxDepth: number = DEFAULT_EXPANDED_DEPTH,
    depth: number = 0
): string[] =>
    depth >= maxDepth
        ? []
        : nodes.flatMap((node) => [
              node.id,
              ...collectExpandedIds(node.children, maxDepth, depth + 1)
          ]);

export { collectExpandedIds as default, DEFAULT_EXPANDED_DEPTH };
