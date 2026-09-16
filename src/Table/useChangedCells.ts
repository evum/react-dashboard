import { useState } from 'react';
import type { OrganizationTableRow } from './convertToTableRows';

const METRIC_COLUMNS = [
    'totalHeadcount',
    'totalBudget',
    'avgPerformance'
] as const;

type MetricColumn = (typeof METRIC_COLUMNS)[number];

type Snapshot = {
    rows: OrganizationTableRow[];
    pulse: number;
    pulseByCell: Map<string, number>;
};

const getCellKey = (id: string, column: MetricColumn) => `${id}:${column}`;

const collectChangedCells = (
    previous: OrganizationTableRow[],
    next: OrganizationTableRow[],
    pulse: number,
    pulseByCell: Map<string, number>
) => {
    const previousById = new Map(previous.map((row) => [row.id, row]));

    for (const row of next) {
        const previousRow = previousById.get(row.id);

        if (!previousRow) {
            continue;
        }

        for (const column of METRIC_COLUMNS) {
            if (previousRow[column] !== row[column]) {
                pulseByCell.set(getCellKey(row.id, column), pulse);
            }
        }
    }
};

const useChangedCells = (rows: OrganizationTableRow[]) => {
    const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
        rows,
        pulse: 0,
        pulseByCell: new Map()
    }));

    if (snapshot.rows !== rows) {
        setSnapshot((current) => {
            const pulse = current.pulse + 1;
            const pulseByCell = new Map(current.pulseByCell);

            collectChangedCells(current.rows, rows, pulse, pulseByCell);

            return { rows, pulse, pulseByCell };
        });
    }

    return (id: string, column: MetricColumn) =>
        snapshot.pulseByCell.get(getCellKey(id, column));
};

export { useChangedCells as default, type MetricColumn };
