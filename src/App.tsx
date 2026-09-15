import styled from 'styled-components';
import Dashboard from '@/Dashboard';
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

    return <Dashboard data={data} />;
}

export default App;
