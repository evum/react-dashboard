# Архитектура

Дашборд — одностраничное React-приложение: слева дерево орг-структуры, справа сводная таблица. Источник правды по метрикам — кэш TanStack Query; дерево и таблица читают один и тот же снимок.

Транспорт живых обновлений сейчас — HTTP-поллинг инкрементальных патчей, не WebSocket. Форма JSON-патча совпадает с тем, что ушло бы в кадр сокета; см. [контракт патча](./data-model.md#контракт-патча-живой-ленты) и [ADR 002](./adr/002-http-polling-patches.md).

## Слои

Слои тонкие и соответствуют каталогам `src/`, без Feature-Sliced Design. Решение — в [ADR 001](./adr/001-flat-src-modules.md).

```
┌─────────────────────────────────────────────────────────────┐
│  UI                                                         │
│  App → Dashboard → TreeList / TableComponent                │
│                    ConnectionStatus                         │
├─────────────────────────────────────────────────────────────┤
│  Состояние экрана (локальный React state)                   │
│  selectedId, expandedIds, view, сортировка, фильтр поиска   │
├─────────────────────────────────────────────────────────────┤
│  Производные данные (чистые функции)                        │
│  convertToTableRows, parseSearchQuery, collectExpandedIds   │
├─────────────────────────────────────────────────────────────┤
│  Клиент данных                                              │
│  GetOrganizationStructure / GetOrganizationChanges          │
│  parse* / applyOrganizationChanges / patchNodes             │
│  кэш QueryClient: ['org-tree'], ['org-tree-changes']        │
├─────────────────────────────────────────────────────────────┤
│  HTTP                                                       │
│  Vite proxy / nginx  →  Node mock API  →  mock/org-tree.json│
└─────────────────────────────────────────────────────────────┘
```

| Слой | Где | Ответственность |
| --- | --- | --- |
| UI | `src/App.tsx`, `src/Dashboard.tsx`, `src/Tree/*`, `src/Table/*`, `src/ConnectionStatus.tsx` | Рендер, ввод, подсветка ячеек, статус соединения. Не ходит в сеть напрямую. |
| Состояние экрана | `Dashboard`, `TableComponent` | Выбор узла, раскрытие веток, мобильный вид, сортировка и поиск. Не хранит метрики. |
| Производные данные | `convertToTableRows.ts`, `parseSearchQuery.ts`, `collectExpandedIds.ts`, `getAncestorIds.ts` | Чистые преобразования дерева в строки, фильтр, начальное раскрытие. Без React. |
| Клиент данных | `src/api/*` | Загрузка, валидация JSON, поллинг патчей, слияние в кэш. Единственное место, где известны URL и `version`. |
| HTTP / API | `server/index.mjs`, `mock/org-tree.json` | Снимок дерева, лента изменений метрик, мок-джиттер. Не знает про UI. |

Граница слоёв: компоненты получают уже разобранный `OrganizationNode[]`. Парсеры бросают ошибку на битый JSON — кэш не заполняется полувалидными узлами.

## Поток данных: API → UI

### 1. Снимок дерева

`main.tsx` поднимает `QueryClientProvider`. `App` вызывает `useOrganizationStructure()`:

1. `GET /api/org-tree`
2. `parseOrganizationStructure` проверяет `version` и рекурсивно каждый узел
3. результат кладётся в кэш под ключом `['org-tree']` (`staleTime` 5 с)

Пока данных нет, `App` показывает загрузку, ошибку или «Нет данных». Когда `nodes.length > 0`, дерево уходит в `Dashboard` как `data`.

Полный снимок ещё раз запрашивается раз в 5 минут (`refetchInterval`) — страховка на случай, если лента патчей пропустила структурное изменение. Интервал растёт с числом ошибок (экспонента + джиттер, потолок 15 мин) — `getPollInterval` в `src/api/utils.ts`.

### 2. Живая лента патчей

`ConnectionStatus` монтирует `useOrganizationChanges()`. Хук не рисует дерево, только синхронизирует кэш:

```
каждые ~5 с
    structure = queryClient.getQueryData(['org-tree'])
    GET /api/org-tree/changes?since={structure.version}
    parseOrganizationChanges
    если reset → invalidateQueries(['org-tree'])   // полный снимок заново
    иначе если changed.length > 0
        setQueryData(['org-tree'], applyOrganizationChanges(structure, changes))
```

`applyOrganizationChanges` поднимает `version` и вызывает `patchNodes`: обход дерева, замена метрик по `id`, structural sharing — нетронутые поддеревья остаются теми же объектами. React Query уведомляет подписчиков; `App` → `Dashboard` получают новый `data`.

`retry: 0` у ленты: ошибка сразу видна в статусе («Переподключение…»), следующий тик поллинга пробует снова. `fetchStatus === 'paused'` (нет сети) даёт «Нет сети».

Сервер крутит таймер (`CHANGE_INTERVAL`, по умолчанию 4 с) и меняет 1–N случайных узлов. Клиент не знает про таймер: он только спрашивает «что изменилось после моей версии».

### 3. Экран

`Dashboard` держит общее UI-состояние:

- `expandedIds: Set<string>` — единственная правда о раскрытых узлах ([ADR 004](./adr/004-expanded-ids-single-source.md))
- `selectedId` — выбранный узел в дереве и таблице
- `view` — дерево/таблица на узкой ширине; от 1280px обе панели рядом

Дерево (`TreeList` → `TreeNode`) рисует **собственные** метрики узла (`headcount`, `performance`). Таблица не читает эти поля напрямую.

### 4. Таблица

`TableComponent` мемоизирует строки:

```
rows = useMemo(() => convertToTableRows(data), [data])
```

Алгоритм агрегации — в [data-model.md](./data-model.md#агрегация). Дальше на клиенте:

1. `parseSearchQuery(appliedFilter)` — фраза → структурированный фильтр или текстовый поиск
2. сортировка по колонке
3. `useChangedCells(rows)` сравнивает предыдущий и новый массив строк и выдаёт «пульс» для ячеек `totalHeadcount` / `totalBudget` / `avgPerformance`
4. `TableRow` перезапускает CSS-анимацию подсветки через `key` с номером пульса

Выбор строки в таблице вызывает `onSelect`: ставит `selectedId`, на мобиле переключает вид на дерево и дописывает в `expandedIds` предков (`getAncestorIds`), чтобы выбранный узел стал виден.

### 5. Обратный поток (только UI)

Пользователь не пишет на сервер. Клиент только читает `GET`. Все мутации — локальные: раскрытие, выбор, сортировка, фильтр.

```
mock JSON ──► Node API ──► parse ──► QueryCache ['org-tree']
                 ▲                         │
                 │ since=version           │ nodes
                 │                         ▼
            GET /changes              Dashboard
                 │                    /        \
                 └─ apply/reset     Tree      Table
                                            convertToTableRows
                                            filter / sort / pulse
```

## Граница «свой» vs «сводный» показатель

| Место | Что показывает |
| --- | --- |
| Дерево | `node.headcount`, `node.performance` — как пришло с API |
| Таблица | `totalHeadcount`, `totalBudget`, `avgPerformance` — сумма / взвешенное среднее по поддереву, включая сам узел |

Патч листа меняет его строку и все строки предков: агрегация считается заново от корней при каждом новом `data`. Кэш патчит только собственные поля узла, не готовые итоги.

## Сборка и доставка

- Dev: Vite на клиентском порту, `proxy: { '/api': API_URL }`.
- Prod: статика + nginx; `/api/` проксируется на `server:3000`, для `/api/org-tree` пробрасывается `ETag` / `If-None-Match`.
- Бюджет бандла: плагин Vite падает, если gzip `dist/` больше 200 КБ.

Внешней LLM в рантайме нет. «AI-поиск» — детерминированный парсер на клиенте ([ADR 007](./adr/007-deterministic-search-parser.md)).
