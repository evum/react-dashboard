import styled from 'styled-components';
import type { OrganizationNode } from '@/api/GetOrganizationStructure';
import convertToTableRows, {
    type OrganizationTableRow
} from '@/Table/convertToTableRows';
import { useMemo, useRef, useState } from 'react';
import TableHeader from './TableHeader';
import { columns, type ColumnName, type SortDirection } from './columns';
import TableRow from './TableRow';

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

const TableComponent = ({
    data,
    selectedId,
    onSelect
}: {
    data: OrganizationNode[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}) => {
    const [sortColumn, setSortColumn] = useState<ColumnName | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(0);
    const [nameFilter, setNameFilter] = useState('');

    const rows = useMemo(() => convertToTableRows(data), [data]);

    const [filteredRows, setFilteredRows] =
        useState<OrganizationTableRow[]>(rows);

    const timerId = useRef<number | null>(null);

    const visibleRows = useMemo(
        () => getSortedRows(filteredRows, sortColumn, sortDirection),
        [filteredRows, sortColumn, sortDirection]
    );

    const filterRows = (nameFilter: string) => {
        setNameFilter(nameFilter);
        if (timerId.current) {
            clearTimeout(timerId.current);
        }
        timerId.current = setTimeout(() => {
            const filteredRows = getFilteredRows(rows, nameFilter);
            setFilteredRows(filteredRows);
        }, FILTER_DEBOUNCE_DELAY);
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
            <tbody>
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
                            onSelect={onSelect}
                        />
                    ))
                )}
            </tbody>
        </Table>
    );
};

export default TableComponent;
