import styled, { css, keyframes } from 'styled-components';
import { useOrganizationChanges } from '@/api/GetOrganizationChanges';

type ConnectionState = 'connecting' | 'online' | 'reconnecting' | 'offline';

const labels: Record<ConnectionState, string> = {
    connecting: 'Подключение…',
    online: 'Онлайн',
    reconnecting: 'Переподключение…',
    offline: 'Нет сети'
};

const toneByState: Record<ConnectionState, string> = {
    connecting: '#ca8a04',
    online: '#16a34a',
    reconnecting: '#ca8a04',
    offline: '#dc2626'
};

const pulse = keyframes`
    from {
        opacity: 1;
    }

    to {
        opacity: 0.35;
    }
`;

const Root = styled.p`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    line-height: 1;
    color: var(--text);
`;

const Dot = styled.span<{ $state: ConnectionState }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $state }) => toneByState[$state]};

    ${({ $state }) =>
        ($state === 'connecting' || $state === 'reconnecting') &&
        css`
            animation: ${pulse} 800ms ease-in-out infinite alternate;

            @media (prefers-reduced-motion: reduce) {
                animation: none;
            }
        `};
`;

const getConnectionState = ({
    isPending,
    isError,
    fetchStatus
}: {
    isPending: boolean;
    isError: boolean;
    fetchStatus: 'fetching' | 'paused' | 'idle';
}): ConnectionState => {
    if (fetchStatus === 'paused') {
        return 'offline';
    }

    if (isPending) {
        return 'connecting';
    }

    if (isError) {
        return 'reconnecting';
    }

    return 'online';
};

const ConnectionStatus = () => {
    const { isPending, isError, fetchStatus, error } = useOrganizationChanges();
    const state = getConnectionState({ isPending, isError, fetchStatus });

    return (
        <Root role="status" aria-live="polite" title={error?.message}>
            <Dot $state={state} aria-hidden="true" />
            {labels[state]}
        </Root>
    );
};

export default ConnectionStatus;
