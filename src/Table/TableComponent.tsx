import styled from 'styled-components';
import type { OrganizationNode } from '@/api/utils';
import convertToTableRows, {
    type OrganizationTableRow
} from '@/Table/convertToTableRows';
import { useMemo, useRef, useState } from 'react';
import TableHeader from './TableHeader';
import { columns, type ColumnName, type SortDirection } from './columns';
import TableRow from './TableRow';
import useChangedCells from './useChangedCells';

const FILTER_DEBOUNCE_DELAY = 250;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
`;

const EmptyCell = styled.td`
    padding: 16px 10px;
    color: var(--text);
    text-align: center;
`;

const getSortedRows = (
    rows: OrganizationTableRow[],
    column: ColumnName | null,
    direction: SortDirection
) => {
    if (!column || direction === 0) {
        return rows;
    }
    return [...rows].sort((a, b) => {
        if (a[column] < b[column]) return -1 * direction;
        if (a[column] > b[column]) return 1 * direction;
        return 0;
    });
};

const getFilteredRows = (
    rows: OrganizationTableRow[],
    nameFilter: string
): OrganizationTableRow[] => {
    const query = nameFilter.trim().toLowerCase();

    if (!query) {
        return rows;
    }

    return rows.filter((row) => row.name.toLowerCase().includes(query));
};

const getActiveRowId = (
    visibleRows: OrganizationTableRow[],
    focusedId: string | null,
    selectedId: string | null
) => {
    if (visibleRows.length === 0) {
        return null;
    }

    if (focusedId && visibleRows.some((row) => row.id === focusedId)) {
        return focusedId;
    }

    if (selectedId && visibleRows.some((row) => row.id === selectedId)) {
        return selectedId;
    }

    return visibleRows[0].id;
};

const TableComponent = ({
    data,
    selectedId,
    onSelect
}: {
    data: OrganizationNode[];
    selectedId: string | null;
    onSelect: (id: string, options?: { toggle?: boolean }) => void;
}) => {
    const [sortColumn, setSortColumn] = useState<ColumnName | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(0);
    const [nameFilter, setNameFilter] = useState('');

    const rows = useMemo(() => convertToTableRows(data), [data]);

    const [appliedFilter, setAppliedFilter] = useState('');
    const [focusedId, setFocusedId] = useState<string | null>(selectedId);

    const timerId = useRef<number | null>(null);
    const bodyRef = useRef<HTMLTableSectionElement>(null);

    const getCellPulse = useChangedCells(rows);

    const visibleRows = useMemo(
        () =>
            getSortedRows(
                getFilteredRows(rows, appliedFilter),
                sortColumn,
                sortDirection
            ),
        [rows, appliedFilter, sortColumn, sortDirection]
    );

    const activeId = useMemo(
        () => getActiveRowId(visibleRows, focusedId, selectedId),
        [visibleRows, focusedId, selectedId]
    );

    const filterRows = (nameFilter: string) => {
        setNameFilter(nameFilter);
        if (timerId.current) {
            clearTimeout(timerId.current);
        }
        timerId.current = setTimeout(() => {
            setAppliedFilter(nameFilter);
        }, FILTER_DEBOUNCE_DELAY);
    };

    const focusRowAt = (index: number) => {
        const row = visibleRows[index];

        if (!row) {
            return;
        }

        setFocusedId(row.id);
        const element = bodyRef.current?.querySelector<HTMLElement>(
            `[data-row-id="${CSS.escape(row.id)}"]`
        );
        element?.focus();
        element?.scrollIntoView({ block: 'nearest' });
    };

    const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
        if (visibleRows.length === 0) {
            return;
        }

        const rowId = (e.target as HTMLElement)
            .closest('[data-row-id]')
            ?.getAttribute('data-row-id');
        const currentIndex = visibleRows.findIndex((row) => row.id === rowId);

        if (currentIndex === -1) {
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                focusRowAt(Math.min(currentIndex + 1, visibleRows.length - 1));
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                focusRowAt(Math.max(currentIndex - 1, 0));
                break;
            case 'Home':
                e.preventDefault();
                focusRowAt(0);
                break;
            case 'End':
                e.preventDefault();
                focusRowAt(visibleRows.length - 1);
                break;
            case 'Enter':
                e.preventDefault();
                onSelect(visibleRows[currentIndex].id, { toggle: false });
                break;
        }
    };

    const onHeaderClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
        const target = (e.target as HTMLElement).closest('[data-column]');
        const column = target?.getAttribute('data-column') as ColumnName;
        if (!column) {
            return;
        }
        const currentDirection = column === sortColumn ? sortDirection : 0;
        setSortColumn(column);
        setSortDirection(
            currentDirection === 1 ? -1 : currentDirection === -1 ? 0 : 1
        );
    };

    return (
        <Table>
            <TableHeader
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                nameFilter={nameFilter}
                onHeaderClick={onHeaderClick}
                onNameFilterChange={filterRows}
            />
            <tbody ref={bodyRef} onKeyDown={onBodyKeyDown}>
                {visibleRows.length === 0 ? (
                    <tr>
                        <EmptyCell colSpan={columns.length}>
                            Ничего не найдено
                        </EmptyCell>
                    </tr>
                ) : (
                    visibleRows.map((row) => (
                        <TableRow
                            key={row.id}
                            row={row}
                            selected={row.id === selectedId}
                            focused={row.id === activeId}
                            onSelect={onSelect}
                            onFocus={setFocusedId}
                            getCellPulse={getCellPulse}
                        />
                    ))
                )}
            </tbody>
        </Table>
    );
};

export default TableComponent;
