import { describe, expect, it } from 'vitest';
import type { OrganizationNode } from '@/api/utils';
import convertToTableRows from '@/Table/convertToTableRows';

const node = (
    id: string,
    parentId: string,
    headcount: number,
    budget: number,
    performance: number,
    children: OrganizationNode[] = []
): OrganizationNode => ({
    id,
    name: id,
    parentId,
    headcount,
    budget,
    performance,
    updatedAt: '2026-01-01T00:00:00.000Z',
    children
});

describe('convertToTableRows', () => {
    it('returns an empty list for an empty tree', () => {
        expect(convertToTableRows([])).toEqual([]);
    });

    it('keeps a leaf as its own metrics', () => {
        const rows = convertToTableRows([node('team', 'dep', 5, 400, 100)]);

        expect(rows).toEqual([
            {
                id: 'team',
                name: 'team',
                level: 1,
                totalHeadcount: 5,
                totalBudget: 400,
                avgPerformance: 100
            }
        ]);
    });

    it('rolls headcount, budget and weighted performance up the tree', () => {
        const team = node('team', 'dep', 5, 400, 100);
        const dep = node('dep', 'div', 3, 200, 80, [team]);
        const div = node('div', '', 2, 100, 50, [dep]);

        const rows = convertToTableRows([div]);

        expect(rows.map((row) => row.id)).toEqual(['div', 'dep', 'team']);
        expect(rows.map((row) => row.level)).toEqual([1, 2, 3]);

        expect(rows[2]).toMatchObject({
            totalHeadcount: 5,
            totalBudget: 400,
            avgPerformance: 100
        });
        expect(rows[1]).toMatchObject({
            totalHeadcount: 8,
            totalBudget: 600,
            avgPerformance: 92.5
        });
        expect(rows[0]).toMatchObject({
            totalHeadcount: 10,
            totalBudget: 700,
            avgPerformance: 84
        });
    });

    it('aggregates several roots independently', () => {
        const rows = convertToTableRows([
            node('north', '', 1, 10, 50),
            node('south', '', 3, 30, 90)
        ]);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            id: 'north',
            totalHeadcount: 1,
            totalBudget: 10,
            avgPerformance: 50
        });
        expect(rows[1]).toMatchObject({
            id: 'south',
            totalHeadcount: 3,
            totalBudget: 30,
            avgPerformance: 90
        });
    });

    it('uses 0 average performance when the subtree has no people', () => {
        const [row] = convertToTableRows([node('empty', '', 0, 100, 80)]);

        expect(row.totalHeadcount).toBe(0);
        expect(row.totalBudget).toBe(100);
        expect(row.avgPerformance).toBe(0);
    });
});
