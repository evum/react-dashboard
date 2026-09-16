import type { OrganizationNode } from '@/api/utils';

type OrganizationTableRow = {
    id: string;
    name: string;
    level: number;
    totalHeadcount: number;
    totalBudget: number;
    avgPerformance: number;
};

type NodeTotals = {
    headcount: number;
    budget: number;
    weightedPerformance: number;
};

type Subtree = {
    totals: NodeTotals;
    rows: OrganizationTableRow[];
};

const addTotals = (left: NodeTotals, right: NodeTotals): NodeTotals => ({
    headcount: left.headcount + right.headcount,
    budget: left.budget + right.budget,
    weightedPerformance: left.weightedPerformance + right.weightedPerformance
});

const ownTotals = (node: OrganizationNode): NodeTotals => ({
    headcount: node.headcount,
    budget: node.budget,
    weightedPerformance: node.performance * node.headcount
});

const toRow = (
    node: OrganizationNode,
    level: number,
    totals: NodeTotals
): OrganizationTableRow => ({
    id: node.id,
    name: node.name,
    level,
    totalHeadcount: totals.headcount,
    totalBudget: totals.budget,
    avgPerformance: totals.headcount
        ? totals.weightedPerformance / totals.headcount
        : 0
});

const visitNode = (node: OrganizationNode, level: number): Subtree => {
    const children = node.children.map((child) => visitNode(child, level + 1));
    const totals = children.reduce(
        (acc, child) => addTotals(acc, child.totals),
        ownTotals(node)
    );
    const row = toRow(node, level, totals);

    return {
        totals,
        rows: [row, ...children.flatMap((child) => child.rows)]
    };
};

const convertToTableRows = (
    nodes: OrganizationNode[]
): OrganizationTableRow[] => nodes.flatMap((node) => visitNode(node, 1).rows);

export type { OrganizationTableRow };
export default convertToTableRows;
