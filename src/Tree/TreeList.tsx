import type { OrgNode } from '@/api/GetOrgStruc';
import TreeNode from './TreeNode';
import TreeListRoot from './TreeListRoot';

const TreeList = ({ data }: { data: OrgNode[] }) => (
    <TreeListRoot>
        {data.map((node) => (
            <TreeNode key={node.id} node={node} />
        ))}
    </TreeListRoot>
);

export default TreeList;
