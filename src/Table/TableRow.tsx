import styled, { css, keyframes } from 'styled-components';
import type { OrganizationTableRow } from './convertToTableRows';
import type { MetricColumn } from './useChangedCells';

const HIGHLIGHT_DURATION = 1500;

const Row = styled.tr<{ $selected: boolean }>`
    cursor: pointer;
    background: ${({ $selected }) =>
        $selected ? 'var(--accent-bg)' : 'transparent'};
    box-shadow: ${({ $selected }) =>
        $selected ? 'inset 3px 0 0 var(--accent)' : 'none'};

    &:hover {
        background: var(--accent-bg);
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
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

const fadeOut = keyframes`
    from {
        background: var(--accent-bg);
    }
    to {
        background: transparent;
    }
`;

const Metric = styled(Numeric)<{ $highlighted: boolean }>`
    ${({ $highlighted }) =>
        $highlighted &&
        css`
            animation: ${fadeOut} ${HIGHLIGHT_DURATION}ms ease-out;

            @media (prefers-reduced-motion: reduce) {
                animation: none;
            }
        `}
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
    focused,
    onSelect,
    onFocus,
    getCellPulse
}: {
    row: OrganizationTableRow;
    selected: boolean;
    focused: boolean;
    onSelect: (id: string) => void;
    onFocus: (id: string) => void;
    getCellPulse: (id: string, column: MetricColumn) => number | undefined;
}) => {
    const headcountPulse = getCellPulse(row.id, 'totalHeadcount');
    const budgetPulse = getCellPulse(row.id, 'totalBudget');
    const performancePulse = getCellPulse(row.id, 'avgPerformance');

    const onRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
        if (e.detail === 0) {
            return;
        }

        onSelect(row.id);
    };

    return (
        <Row
            $selected={selected}
            tabIndex={focused ? 0 : -1}
            data-row-id={row.id}
            aria-current={selected ? 'true' : undefined}
            onClick={onRowClick}
            onFocus={() => onFocus(row.id)}
        >
            <Td>
                <UnitName $level={row.level}>{row.name}</UnitName>
            </Td>
            <Numeric>{row.level}</Numeric>
            <Metric
                key={`totalHeadcount-${headcountPulse ?? 0}`}
                $highlighted={headcountPulse !== undefined}
            >
                {row.totalHeadcount}
            </Metric>
            <Metric
                key={`totalBudget-${budgetPulse ?? 0}`}
                $highlighted={budgetPulse !== undefined}
            >
                {formatBudget(row.totalBudget)}
            </Metric>
            <Metric
                key={`avgPerformance-${performancePulse ?? 0}`}
                $highlighted={performancePulse !== undefined}
            >
                {formatPerformance(row.avgPerformance)}
            </Metric>
        </Row>
    );
};

export default TableRow;
