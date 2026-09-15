import styled from 'styled-components';
import type { OrganizationTableRow } from './convertToTableRows';

const Row = styled.tr<{ $selected: boolean }>`
    cursor: pointer;
    background: ${({ $selected }) =>
        $selected ? 'var(--accent-bg)' : 'transparent'};
    box-shadow: ${({ $selected }) =>
        $selected ? 'inset 3px 0 0 var(--accent)' : 'none'};

    &:hover {
        background: var(--accent-bg);
    }
`;

const Td = styled.td`
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
`;

const Numeric = styled(Td)`
    text-align: center;
    font-variant-numeric: tabular-nums;
`;

const UnitName = styled.span<{ $level: number }>`
    padding-left: ${({ $level }) => ($level - 1) * 16}px;
    color: var(--text-h);
`;

const formatBudget = (value: number) =>
    value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' руб.';

const formatPerformance = (value: number) => `${Math.round(value)}%`;

const TableRow = ({
    row,
    selected,
    onSelect
}: {
    row: OrganizationTableRow;
    selected: boolean;
    onSelect: (id: string) => void;
}) => (
    <Row
        $selected={selected}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(row.id)}
    >
        <Td>
            <UnitName $level={row.level}>{row.name}</UnitName>
        </Td>
        <Numeric>{row.level}</Numeric>
        <Numeric>{row.totalHeadcount}</Numeric>
        <Numeric>{formatBudget(row.totalBudget)}</Numeric>
        <Numeric>{formatPerformance(row.avgPerformance)}</Numeric>
    </Row>
);

export default TableRow;
