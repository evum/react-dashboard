# Модель данных

Документ описывает дерево орг-структуры, как из него получаются строки таблицы и контракт живого патча метрик.

Транспорт патча в текущей реализации — `GET /api/org-tree/changes`. JSON тот же, что ушёл бы в WebSocket-кадр; сокет не используется ([ADR 002](./adr/002-http-polling-patches.md)).

## Дерево

Снимок: `GET /api/org-tree`.

```ts
type OrganizationStructure = {
    version: number;
    nodes: OrganizationNode[];
};

type OrganizationNode = {
    id: string;
    name: string;
    parentId: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: string; // ISO-8601, валидная дата
    children: OrganizationNode[];
};
```

Корни — элементы `nodes` (`parentId` пустая строка). Иерархия только через `children`; `parentId` дублирует родителя для отладки и моков, клиент по нему дерево не собирает.

Типичная глубина в моке: дивизион (уровень 1) → отдел (2) → команда (3) → сквад (4). Модель глубину не ограничивает.

Инварианты, которые проверяет `parseOrganizationNode`:

- `id`, `name`, `parentId` — строки
- `headcount`, `budget`, `performance` — конечные числа
- `updatedAt` — дата (строка или `Date` → ISO)
- `children` — массив; каждый элемент — снова `OrganizationNode`

Сервер хранит то же дерево в памяти, что отдал в снимке. Метрики узлов мутируются на месте; структура (`id`, `name`, `parentId`, `children`) моком не меняется. Если клиент всё же оказывается «в будущем» или без версии — сервер отвечает `reset: true`, клиент перечитывает полный снимок.

`version` — монотонный счётчик сервера. Каждая порция мок-изменений делает `version += 1` и помечает затронутые `id` этой версией. Это не hash дерева и не вектор часов.

Собственные метрики узла **не** включают потомков. Отдел с `headcount: 6` — это люди «на отделе», не сумма команд. Суммы считает только таблица.

## Агрегация

`convertToTableRows(nodes): OrganizationTableRow[]` — чистая функция, один обход каждого корня.

```ts
type OrganizationTableRow = {
    id: string;
    name: string;
    level: number;
    totalHeadcount: number;
    totalBudget: number;
    avgPerformance: number;
};
```

Для узла `n` с детьми `c1…ck`:

```
own.weighted = n.performance * n.headcount

totals.headcount = n.headcount + Σ ci.totalHeadcount
totals.budget    = n.budget    + Σ ci.totalBudget
totals.weighted  = own.weighted + Σ (ci.avgPerformance * ci.totalHeadcount)

avgPerformance   = totals.headcount === 0
    ? 0
    : totals.weighted / totals.headcount
```

Эффективность — **среднее, взвешенное по численности**, не среднее «по узлам» и не KPI родителя как есть. Лист совпадает со своими полями. Несколько корней агрегируются независимо и склеиваются в один список строк. Обоснование — [ADR 006](./adr/006-weighted-performance.md).

Порядок строк — pre-order: родитель, затем поддеревья слева направо. `level` корня = 1, дети = `level + 1`.

Пример из теста (`div` 2 чел. / 50%, `dep` 3 / 80%, `team` 5 / 100%):

| id | level | сотрудники | бюджет | эффективность |
| --- | ---: | ---: | ---: | ---: |
| team | 3 | 5 | 400 | 100 |
| dep | 2 | 8 | 600 | 92.5 |
| div | 1 | 10 | 700 | 84 |

`dep`: `(80×3 + 100×5) / 8 = 92.5`. `div`: `(50×2 + 92.5×8) / 10 = 84`.

Таблица не хранит строки в кэше Query. При любом новом `data` (в том числе после патча листа) агрегация пересчитывается целиком; `useMemo` зависит только от ссылки `data`.

Дерево в UI агрегацию не использует: точка эффективности и «N чел.» берутся из `OrganizationNode`.

## Контракт патча живой ленты

Патч меняет **только метрики** уже известных узлов. Имя, родитель, состав детей в патче не передаются.

### Сообщение (JSON)

Это тело HTTP-ответа и в то же время контракт кадра, если ленту перенесут на WebSocket.

```ts
type OrganizationNodePatch = {
    id: string;
    headcount: number;
    budget: number;
    performance: number;
    updatedAt: string;
};

type OrganizationChanges = {
    version: number;
    changed: OrganizationNodePatch[];
    reset: boolean;
};
```

| Поле | Смысл |
| --- | --- |
| `version` | Текущая версия сервера после этих изменений. Клиент запоминает её как новый `since`. |
| `changed` | Полные новые метрики узлов, не дельты. Пустой массив — с момента `since` ничего не менялось. |
| `reset` | `true` — снимок клиента нельзя догнать патчами, нужен `GET /api/org-tree`. При `reset` клиент **игнорирует** `changed`. |

Патч идемпотентен относительно `id`: повторное применение тех же чисел даёт то же дерево. Порядок элементов в `changed` не важен. Неизвестный `id` клиент молча пропускает (`patchNodes` ищет только существующие узлы).

Клиент не шлёт патчи на сервер.

### HTTP (как сейчас)

```
GET /api/org-tree/changes?since={n}
Cache-Control: no-store
```

`since` — `version` из последнего успешного снимка или патча.

| Условие | Ответ |
| --- | --- |
| `since` не число или `since > version` на сервере | `{ version, changed: [], reset: true }` |
| `since <= version` | `{ version, changed }` — узлы с `nodeVersion > since`. Поле `reset` отсутствует (= false на клиенте). |

Примеры:

Клиент отстаёт, два узла изменились после версии 10:

```http
GET /api/org-tree/changes?since=10
```

```json
{
    "version": 12,
    "changed": [
        {
            "id": "team-sales-a",
            "headcount": 4,
            "budget": 1010000,
            "performance": 77,
            "updatedAt": "2026-09-16T12:04:01.120Z"
        },
        {
            "id": "dep-sales-n",
            "headcount": 6,
            "budget": 1905000,
            "performance": 71,
            "updatedAt": "2026-09-16T12:04:05.003Z"
        }
    ]
}
```

Клиент «в будущем» или без валидного `since`:

```json
{ "version": 12, "changed": [], "reset": true }
```

Полный снимок при `reset` / старте:

```http
GET /api/org-tree
```

```json
{
    "version": 12,
    "nodes": [ { "id": "div-north", "children": [ "…" ] } ]
}
```

У снимка есть `ETag` (SHA-1 тела). Повтор с тем же деревом может дать 304; лента патчей 304 не использует.

Клиент: `parseOrganizationChanges` → при `reset` инвалидация `['org-tree']`, иначе `applyOrganizationChanges`. Слияние:

1. `Map<id, patch>` из `changed`
2. рекурсивный `patchNodes`: если есть патч — новые `headcount`, `budget`, `performance`, `updatedAt`; `name` / `parentId` / `id` не трогать
3. если ни узел, ни дети не изменились — вернуть прежнюю ссылку
4. `structure.version = changes.version`

Интервал опроса ~5 с, backoff как у снимка. Параллельных подписок на ленту две быть не должно: хук живёт в одном `ConnectionStatus`.

### WebSocket (целевой кадр, не реализован)

Если появится сокет, кадр сервера → клиент — тот же JSON `OrganizationChanges`. Отдельный бинарный протокол не нужен.

Предлагаемые правила (не код, ориентир при смене транспорта):

1. После `open` клиент не применяет патчи, пока нет снимка с `version`.
2. Сервер шлёт только сообщения с `version` строго больше последней применённой. Пропуски не склеиваются: при разрыве — `reset` или повторный снимок.
3. `reset: true` на сокете = «перечитай `GET /api/org-tree`», не «дерево пустое».
4. Клиент → сервер: только служебное (pong / `since` после reconnect). Запись метрик с UI не входит в контракт.

Пока этого канала нет: те же инварианты выполняются запросом с `?since=`.
