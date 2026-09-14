import styled from 'styled-components';
import TreeList from '@/Tree/TreeList';
import { useOrganizationStructure } from '@/api/GetOrganizationStructure';

const Status = styled.p`
    margin: 0;
    color: var(--text);
`;

function App() {
    const { data, isPending, error } = useOrganizationStructure();
    if (error) {
        return <Status>Не удалось загрузить дерево: {error.message}</Status>;
    }

    if (isPending) {
        return <Status>Загрузка структуры организации…</Status>;
    }

    if (!data?.length) {
        return <Status>Нет данных</Status>;
    }

    return (
        <nav aria-label="Структура организации">
            <TreeList data={data} />
        </nav>
    );
}

export default App;
