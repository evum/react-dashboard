import type { OrganizationTableRow } from './convertToTableRows';

type CompareOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

type MetricColumn = 'totalHeadcount' | 'totalBudget' | 'avgPerformance';

type MetricClause = {
    column: MetricColumn;
    op: CompareOp;
    value: number;
};

type StructuredFilter = {
    kind: 'structured';
    name?: string;
    level?: number;
    metrics: MetricClause[];
};

type TextFilter = {
    kind: 'text';
    query: string;
};

type SearchFilter = StructuredFilter | TextFilter;

const NUMBER_PATTERN =
    '(\\d{1,3}(?:[ \\u00a0]\\d{3})+|\\d+(?:[.,]\\d+)?)(?:\\s*(млн|миллион(?:а|ов)?|тыс(?:яч(?:и|а)?)?|к|%))?';

const COMPARE_PATTERN =
    '(не\\s+менее|не\\s+ниже|как\\s+минимум|минимум|не\\s+более|не\\s+выше|как\\s+максимум|максимум|больше|более|свыше|выше|меньше|менее|ниже|равно|равняется|>=|<=|>|<|=)';

const METRIC_PATTERN =
    '(эффективност(?:ью|ь|и)|kpi|performance|сотрудник(?:и|ов|ами)?|человек(?:а|ек)?|численност(?:ью|ь|и)|штат(?:а|у|ом)?|headcount|бюджет(?:а|у|ом)?|budget)';

const STOPWORDS = new Set([
    'с',
    'со',
    'и',
    'или',
    'в',
    'во',
    'на',
    'по',
    'для',
    'у',
    'где',
    'чей',
    'чья',
    'чьи',
    'который',
    'которая',
    'которые',
    'которых',
    'как',
    'то',
    'те',
    'этот',
    'эта'
]);

const LEVEL_WORDS: { pattern: RegExp; level: number }[] = [
    { pattern: /дивизион(?:ы|ов|а|е)?/g, level: 1 },
    { pattern: /отдел(?:ы|ов|а|е)?/g, level: 2 },
    { pattern: /команд(?:а|ы|е|у|ой)?/g, level: 3 },
    { pattern: /сквад(?:ы|ов|а|е)?/g, level: 4 }
];

const LEVEL_TITLES: Record<number, string> = {
    1: 'дивизион',
    2: 'отдел',
    3: 'команда',
    4: 'сквад'
};

const METRIC_TITLES: Record<MetricColumn, string> = {
    totalHeadcount: 'сотрудники',
    totalBudget: 'бюджет',
    avgPerformance: 'эффективность'
};

const OP_TITLES: Record<CompareOp, string> = {
    eq: '=',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤'
};

const normalize = (value: string) =>
    value.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();

const parseNumberToken = (raw: string, scale?: string) => {
    const value = Number(raw.replaceAll(/[ \u00a0]/g, '').replace(',', '.'));

    if (!Number.isFinite(value)) {
        return null;
    }

    if (!scale || scale === '%') {
        return value;
    }

    if (scale.startsWith('млн') || scale.startsWith('миллион')) {
        return value * 1_000_000;
    }

    if (scale.startsWith('тыс') || scale === 'к') {
        return value * 1_000;
    }

    return value;
};

const opFromPhrase = (phrase: string): CompareOp => {
    if (
        phrase === '>=' ||
        phrase.startsWith('не менее') ||
        phrase.startsWith('не ниже') ||
        phrase.includes('минимум')
    ) {
        return 'gte';
    }

    if (
        phrase === '<=' ||
        phrase.startsWith('не более') ||
        phrase.startsWith('не выше') ||
        phrase.includes('максимум')
    ) {
        return 'lte';
    }

    if (
        phrase === '>' ||
        phrase === 'больше' ||
        phrase === 'более' ||
        phrase === 'свыше' ||
        phrase === 'выше'
    ) {
        return 'gt';
    }

    if (
        phrase === '<' ||
        phrase === 'меньше' ||
        phrase === 'менее' ||
        phrase === 'ниже'
    ) {
        return 'lt';
    }

    return 'eq';
};

const columnFromMetric = (metric: string): MetricColumn => {
    if (
        metric.startsWith('эффективн') ||
        metric === 'kpi' ||
        metric === 'performance'
    ) {
        return 'avgPerformance';
    }

    if (metric.startsWith('бюджет') || metric === 'budget') {
        return 'totalBudget';
    }

    return 'totalHeadcount';
};

const inferColumn = (value: number): MetricColumn => {
    if (value <= 100) {
        return 'avgPerformance';
    }

    if (value >= 1000) {
        return 'totalBudget';
    }

    return 'totalHeadcount';
};

const takeFirst = (
    input: string,
    pattern: RegExp
): { match: RegExpExecArray; rest: string } | null => {
    const flags = pattern.global ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    const match = globalPattern.exec(input);

    if (!match) {
        return null;
    }

    const rest = `${input.slice(0, match.index)} ${input.slice(
        match.index + match[0].length
    )}`;

    return { match, rest: rest.replace(/\s+/g, ' ').trim() };
};

const extractMetrics = (input: string) => {
    let rest = input;
    const metrics: MetricClause[] = [];

    const range = new RegExp(
        `${METRIC_PATTERN}\\s+от\\s+${NUMBER_PATTERN}\\s+до\\s+${NUMBER_PATTERN}`,
        'i'
    );
    const metricCompare = new RegExp(
        `${METRIC_PATTERN}\\s+${COMPARE_PATTERN}\\s+${NUMBER_PATTERN}`,
        'i'
    );
    const compareMetric = new RegExp(
        `${COMPARE_PATTERN}\\s+${NUMBER_PATTERN}\\s+${METRIC_PATTERN}`,
        'i'
    );
    const metricUntil = new RegExp(
        `${METRIC_PATTERN}\\s+до\\s+${NUMBER_PATTERN}`,
        'i'
    );
    const compareOnly = new RegExp(
        `${COMPARE_PATTERN}\\s+${NUMBER_PATTERN}`,
        'i'
    );

    const push = (
        column: MetricColumn,
        op: CompareOp,
        raw: string,
        scale?: string
    ) => {
        const value = parseNumberToken(raw, scale);

        if (value === null) {
            return false;
        }

        metrics.push({ column, op, value });
        return true;
    };

    for (;;) {
        const ranged = takeFirst(rest, range);

        if (ranged) {
            const from = parseNumberToken(ranged.match[2], ranged.match[3]);
            const to = parseNumberToken(ranged.match[4], ranged.match[5]);

            if (from !== null && to !== null) {
                const column = columnFromMetric(ranged.match[1].toLowerCase());
                metrics.push({ column, op: 'gte', value: from });
                metrics.push({ column, op: 'lte', value: to });
                rest = ranged.rest;
                continue;
            }
        }

        const withMetric = takeFirst(rest, metricCompare);

        if (withMetric) {
            if (
                push(
                    columnFromMetric(withMetric.match[1].toLowerCase()),
                    opFromPhrase(withMetric.match[2].toLowerCase()),
                    withMetric.match[3],
                    withMetric.match[4]
                )
            ) {
                rest = withMetric.rest;
                continue;
            }
        }

        const afterCompare = takeFirst(rest, compareMetric);

        if (afterCompare) {
            if (
                push(
                    columnFromMetric(afterCompare.match[4].toLowerCase()),
                    opFromPhrase(afterCompare.match[1].toLowerCase()),
                    afterCompare.match[2],
                    afterCompare.match[3]
                )
            ) {
                rest = afterCompare.rest;
                continue;
            }
        }

        const until = takeFirst(rest, metricUntil);

        if (until) {
            if (
                push(
                    columnFromMetric(until.match[1].toLowerCase()),
                    'lte',
                    until.match[2],
                    until.match[3]
                )
            ) {
                rest = until.rest;
                continue;
            }
        }

        const bare = takeFirst(rest, compareOnly);

        if (bare) {
            const value = parseNumberToken(bare.match[2], bare.match[3]);

            if (value !== null) {
                metrics.push({
                    column: inferColumn(value),
                    op: opFromPhrase(bare.match[1].toLowerCase()),
                    value
                });
                rest = bare.rest;
                continue;
            }
        }

        break;
    }

    return { metrics, rest };
};

const extractLevel = (input: string) => {
    let rest = input;
    let level: number | undefined;

    const numbered = takeFirst(rest, /уров(?:ень|ня|не)\s+(\d+)/i);

    if (numbered) {
        level = Number(numbered.match[1]);
        rest = numbered.rest;
    }

    for (const { pattern, level: next } of LEVEL_WORDS) {
        const found = takeFirst(rest, pattern);

        if (found) {
            level = next;
            rest = found.rest;
            break;
        }
    }

    return { level, rest };
};

const leftoverName = (input: string) => {
    const name = input
        .split(' ')
        .filter((word) => word && !STOPWORDS.has(word))
        .join(' ')
        .trim();

    return name || undefined;
};

const parseSearchQuery = (raw: string): SearchFilter => {
    const query = normalize(raw);

    if (!query) {
        return { kind: 'text', query: '' };
    }

    const withMetrics = extractMetrics(query);
    const withLevel = extractLevel(withMetrics.rest);
    const name = leftoverName(withLevel.rest);
    const hasStructure =
        withMetrics.metrics.length > 0 || withLevel.level !== undefined;

    if (!hasStructure) {
        return { kind: 'text', query };
    }

    return {
        kind: 'structured',
        name,
        level: withLevel.level,
        metrics: withMetrics.metrics
    };
};

const matchesOp = (value: number, op: CompareOp, target: number) => {
    switch (op) {
        case 'eq':
            return value === target;
        case 'gt':
            return value > target;
        case 'gte':
            return value >= target;
        case 'lt':
            return value < target;
        case 'lte':
            return value <= target;
    }
};

const matchesText = (name: string, query: string) => {
    const haystack = name.toLowerCase().replaceAll('ё', 'е');

    if (haystack.includes(query)) {
        return true;
    }

    if (query.length < 3) {
        return false;
    }

    return haystack
        .split(/[\s-]+/)
        .some(
            (word) =>
                word.startsWith(query) ||
                (word.length >= 3 && query.startsWith(word))
        );
};

const applySearchFilter = (
    rows: OrganizationTableRow[],
    filter: SearchFilter
): OrganizationTableRow[] => {
    if (filter.kind === 'text') {
        if (!filter.query) {
            return rows;
        }

        return rows.filter((row) => matchesText(row.name, filter.query));
    }

    return rows.filter((row) => {
        if (filter.name && !matchesText(row.name, filter.name)) {
            return false;
        }

        if (filter.level !== undefined && row.level !== filter.level) {
            return false;
        }

        return filter.metrics.every((clause) =>
            matchesOp(row[clause.column], clause.op, clause.value)
        );
    });
};

const formatFilterValue = (column: MetricColumn, value: number) => {
    if (column === 'avgPerformance') {
        return `${value}%`;
    }

    if (column === 'totalBudget') {
        return `${value.toLocaleString('ru-RU')} руб.`;
    }

    return String(value);
};

const describeSearchFilter = (filter: SearchFilter) => {
    if (filter.kind === 'text') {
        return null;
    }

    const parts: string[] = [];

    if (filter.level !== undefined) {
        parts.push(`уровень: ${LEVEL_TITLES[filter.level] ?? filter.level}`);
    }

    if (filter.name) {
        parts.push(`название: «${filter.name}»`);
    }

    for (const clause of filter.metrics) {
        parts.push(
            `${METRIC_TITLES[clause.column]} ${OP_TITLES[clause.op]} ${formatFilterValue(
                clause.column,
                clause.value
            )}`
        );
    }

    return parts.join(' · ');
};

export { applySearchFilter, describeSearchFilter, parseSearchQuery };
export type { SearchFilter };
