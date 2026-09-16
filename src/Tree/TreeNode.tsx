import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import type { OrganizationNode } from '@/api/utils';
import Expandable from '@/Tree/Expandable';
import TreeListRoot from '@/Tree/TreeListRoot';

type TreeNodeProps = {
    node: OrganizationNode;
    selectedId: string | null;
    expandedIds: Set<string>;
    onToggle: (id: string, expanded: boolean) => void;
};

type PerformanceTone = 'good' | 'warn' | 'bad';

const performanceColors: Record<PerformanceTone, string> = {
    good: '#16a34a',
    warn: '#ca8a04',
    bad: '#dc2626'
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

const NodeRow = styled.button<{ $selected: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    background: ${({ $selected }) =>
        $selected ? 'var(--accent-bg)' : 'transparent'};
    box-shadow: ${({ $selected }) =>
        $selected ? 'inset 3px 0 0 var(--accent)' : 'none'};
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

const NodeName = styled.span<{ $selected: boolean }>`
    font-weight: ${({ $selected }) => ($selected ? 600 : 500)};
    color: ${({ $selected }) =>
        $selected ? 'var(--accent)' : 'var(--text-h)'};
`;

const Metrics = styled.span`
    margin-left: auto;
    font-size: 14px;
    color: var(--text);
`;

const TreeNode = ({
    node,
    selectedId,
    expandedIds,
    onToggle
}: TreeNodeProps) => {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const selected = node.id === selectedId;
    const rowRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (selected) {
            rowRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [selected]);

    const onNodeClick = () => hasChildren && onToggle(node.id, !expanded);

    return (
        <li key={node.id}>
            <NodeRow
                ref={rowRef}
                type="button"
                $selected={selected}
                aria-current={selected ? 'true' : undefined}
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
                <NodeName $selected={selected}>{node.name}</NodeName>
                <Metrics>{node.headcount} чел.</Metrics>
            </NodeRow>
            {hasChildren ? (
                <Expandable expanded={expanded}>
                    <InnerTree>
                        {node.children.map((child) => (
                            <TreeNode
                                key={child.id}
                                node={child}
                                selectedId={selectedId}
                                expandedIds={expandedIds}
                                onToggle={onToggle}
                            />
                        ))}
                    </InnerTree>
                </Expandable>
            ) : null}
        </li>
    );
};

export default TreeNode;
