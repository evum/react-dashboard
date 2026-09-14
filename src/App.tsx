import styled from 'styled-components';
import TreeList from './Tree/TreeList';
import { useOrgTree } from './api/GetOrgStruc';
import '@/App.css';

const Status = styled.p`
    margin: 0;
    color: var(--text);
`;

function App() {
    const { data, isPending, error } = useOrgTree();

    if (isPending) {
        return <Status>Загрузка орг-структуры…</Status>;
    }

    if (error) {
        return <Status>Не удалось загрузить дерево: {error.message}</Status>;
    }

    if (!data?.length) {
        return <Status>Нет данных</Status>;
    }

    return (
        <nav aria-label="Орг-структура">
            <TreeList data={data} />
        </nav>
    );
}

export default App;
