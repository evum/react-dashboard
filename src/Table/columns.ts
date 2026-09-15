import type { OrganizationTableRow } from './convertToTableRows';

type ColumnName = keyof OrganizationTableRow;
type SortDirection = 1 | -1 | 0;

type Column = {
    name: ColumnName;
    title: string;
};

const columns: Column[] = [
    { name: 'name', title: 'Подразделение' },
    { name: 'level', title: 'Уровень' },
    { name: 'totalHeadcount', title: 'Всего сотрудников' },
    { name: 'totalBudget', title: 'Бюджет суммарный' },
    { name: 'avgPerformance', title: 'Средняя эффективность' }
];

export { columns, type Column, type ColumnName, type SortDirection };
