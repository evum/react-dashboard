import type { OrganizationNode } from '@/api/GetOrganizationStructure';
import TreeNode from '@/Tree/TreeNode';
import TreeListRoot from '@/Tree/TreeListRoot';

const TreeList = ({ data }: { data: OrganizationNode[] }) => (
    <TreeListRoot>
        {data.map((node) => (
            <TreeNode key={node.id} node={node} />
        ))}
    </TreeListRoot>
);

export default TreeList;
