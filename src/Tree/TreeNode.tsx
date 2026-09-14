import { useState } from 'react';
import styled from 'styled-components';
import { type OrganizationNode } from '@/api/GetOrganizationStructure';
import TreeListRoot from '@/Tree/TreeListRoot';

type TreeNodeProps = {
    node: OrganizationNode;
    depth?: number;
};

type PerformanceTone = 'good' | 'warn' | 'bad';

const performanceColors: Record<PerformanceTone, string> = {
    good: '#16a34a',
    warn: '#ca8a04',
    bad: '#dc2626',
};

const getPerformanceTone = (value: number): PerformanceTone => {
    if (value >= 80) {
        return 'good';
    }

    if (value >= 60) {
        return 'warn';
    }

    return 'bad';
};

const InnerTree = styled(TreeListRoot)`
    padding-left: 20px;
`;

const NodeRow = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;

    &:hover {
        background: var(--accent-bg);
    }
`;

const Toggle = styled.span`
    width: 12px;
    flex-shrink: 0;
`;

const PerformanceDot = styled.span<{ $tone: PerformanceTone }>`
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
    background: ${({ $tone }) => performanceColors[$tone]};
`;

const NodeName = styled.span`
    font-weight: 500;
    color: var(--text-h);
`;

const Metrics = styled.span`
    margin-left: auto;
    font-size: 14px;
    color: var(--text);
`;

const renderChildren = (children: OrganizationNode[], depth: number) => (
    <InnerTree>
        {children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth} />
        ))}
    </InnerTree>
);

const TreeNode = ({ node, depth = 0 }: TreeNodeProps) => {
    const hasChildren = node.children.length > 0;
    const [expanded, setExpanded] = useState(depth < 2);

    const onNodeClick = () => hasChildren && setExpanded((value) => !value);

    return (
        <li key={node.id}>
            <NodeRow
                type="button"
                onClick={onNodeClick}
                aria-expanded={hasChildren ? expanded : undefined}
            >
                <Toggle>{hasChildren ? (expanded ? '▾' : '▸') : ''}</Toggle>
                <PerformanceDot
                    $tone={getPerformanceTone(node.performance)}
                    role="img"
                    aria-label={`эффективность ${node.performance}%`}
                    title={`эффективность ${node.performance}%`}
                />
                <NodeName>{node.name}</NodeName>
                <Metrics>{node.headcount} чел.</Metrics>
            </NodeRow>
            {hasChildren && expanded
                ? renderChildren(node.children, depth + 1)
                : null}
        </li>
    );
};

export default TreeNode;
