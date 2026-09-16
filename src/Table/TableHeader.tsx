import styled from 'styled-components';
import { columns, type ColumnName, type SortDirection } from './columns';

const Th = styled.th`
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text-h);
    font-weight: 500;
    white-space: nowrap;
    text-align: center;
    cursor: pointer;
`;

const FilterCell = styled.th`
    padding: 6px 10px 10px;
    border-bottom: 1px solid var(--border);
    font-weight: 400;
`;

const FilterInput = styled.input`
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: transparent;
    color: var(--text-h);
    font: inherit;
    font-size: 13px;

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -1px;
    }
`;

const FilterHint = styled.p`
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--text);
`;

const SortMark = styled.span`
    display: inline-block;
    width: 12px;
    margin-left: 4px;
    color: var(--accent);
`;

const sortMarks: Record<SortDirection, string> = {
    1: '↑',
    '-1': '↓',
    0: ''
};

const ariaSort: Record<SortDirection, 'ascending' | 'descending' | 'none'> = {
    1: 'ascending',
    '-1': 'descending',
    0: 'none'
};

const TableHeader = ({
    sortColumn,
    sortDirection,
    nameFilter,
    filterHint,
    onHeaderClick,
    onNameFilterChange
}: {
    sortColumn: ColumnName | null;
    sortDirection: SortDirection;
    nameFilter: string;
    filterHint: string | null;
    onHeaderClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
    onNameFilterChange: (value: string) => void;
}) => (
    <thead>
        <tr onClick={onHeaderClick}>
            {columns.map(({ name, title }) => (
                <Th
                    key={name}
                    data-column={name}
                    aria-sort={
                        ariaSort[name === sortColumn ? sortDirection : 0]
                    }
                >
                    {title}
                    <SortMark aria-hidden="true">
                        {sortMarks[name === sortColumn ? sortDirection : 0]}
                    </SortMark>
                </Th>
            ))}
        </tr>
        <tr>
            <FilterCell colSpan={columns.length}>
                <FilterInput
                    type="search"
                    value={nameFilter}
                    placeholder="отделы с эффективностью ниже 70"
                    aria-label="Поиск по оргструктуре"
                    onChange={(e) => onNameFilterChange(e.target.value)}
                />
                {filterHint ? (
                    <FilterHint role="status">{filterHint}</FilterHint>
                ) : null}
            </FilterCell>
        </tr>
    </thead>
);

export default TableHeader;
