import type { OrganizationNode } from '@/api/utils';
import TreeNode from '@/Tree/TreeNode';
import TreeListRoot from '@/Tree/TreeListRoot';

const TreeList = ({
    data,
    selectedId,
    expandedIds,
    onToggle
}: {
    data: OrganizationNode[];
    selectedId: string | null;
    expandedIds: Set<string>;
    onToggle: (id: string, expanded: boolean) => void;
}) => (
    <TreeListRoot>
        {data.map((node) => (
            <TreeNode
                key={node.id}
                node={node}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onToggle={onToggle}
            />
        ))}
    </TreeListRoot>
);

export default TreeList;
