import { useState } from 'react';
import styled from 'styled-components';
import ConnectionStatus from '@/ConnectionStatus';
import TableComponent from '@/Table/TableComponent';
import TreeList from '@/Tree/TreeList';
import collectExpandedIds from '@/Tree/collectExpandedIds';
import getAncestorIds from '@/Tree/getAncestorIds';
import type { OrganizationNode } from './api/utils';

type ViewMode = 'tree' | 'table';

const Layout = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
    height: 100vh;
`;

const Header = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
`;

const Title = styled.h1`
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.3px;
    line-height: 1.2;
`;

const Switch = styled.div`
    display: flex;
    gap: 4px;
    align-self: flex-start;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 8px;

    @media (min-width: 1280px) {
        display: none;
    }
`;

const SwitchButton = styled.button<{ $active: boolean }>`
    padding: 6px 12px;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    color: ${({ $active }) => ($active ? 'var(--text-h)' : 'var(--text)')};
    background: ${({ $active }) => ($active ? 'var(--accent-bg)' : 'transparent')};
`;

const Split = styled.div`
    display: grid;
    gap: 24px;
    min-width: 0;
    min-height: 0px;
    flex: 1;

    @media (min-width: 1280px) {
        grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
        align-items: stretch;
    }
`;

const Pane = styled.section<{ $visible: boolean }>`
    display: ${({ $visible }) => ($visible ? 'block' : 'none')};
    min-width: 0;
    overflow: auto;

    @media (min-width: 1280px) {
        display: block;
    }
`;

const Dashboard = ({ data }: { data: OrganizationNode[] }) => {
    const [view, setView] = useState<ViewMode>('tree');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState(
        () => new Set(collectExpandedIds(data))
    );

    const onToggle = (id: string, expanded: boolean) =>
        setExpandedIds((current) => {
            const next = new Set(current);

            if (expanded) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });

    const onSelect = (id: string, { toggle = true }: { toggle?: boolean } = {}) => {
        const newId = toggle && selectedId === id ? null : id;
        setSelectedId(newId);

        if (!newId) {
            return;
        }

        setView('tree');
        setExpandedIds(
            (current) => new Set([...current, ...getAncestorIds(data, newId)])
        );
    };

    return (
        <Layout>
            <Header>
                <Title>Организационная структура</Title>
                <ConnectionStatus />
            </Header>
            <Switch role="tablist" aria-label="Вид">
                <SwitchButton
                    type="button"
                    role="tab"
                    $active={view === 'tree'}
                    aria-selected={view === 'tree'}
                    onClick={() => setView('tree')}
                >
                    Дерево
                </SwitchButton>
                <SwitchButton
                    type="button"
                    role="tab"
                    $active={view === 'table'}
                    aria-selected={view === 'table'}
                    onClick={() => setView('table')}
                >
                    Таблица
                </SwitchButton>
            </Switch>
            <Split>
                <Pane
                    $visible={view === 'tree'}
                    aria-label="Структура организации"
                >
                    <TreeList
                        data={data}
                        selectedId={selectedId}
                        expandedIds={expandedIds}
                        onToggle={onToggle}
                    />
                </Pane>
                <Pane $visible={view === 'table'} aria-label="Сводная таблица">
                    <TableComponent
                        data={data}
                        selectedId={selectedId}
                        onSelect={onSelect}
                    />
                </Pane>
            </Split>
        </Layout>
    );
};

export default Dashboard;
