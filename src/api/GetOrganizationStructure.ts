import { useQuery } from '@tanstack/react-query';
import {
    fetchJson,
    getPollInterval,
    parseOrganizationStructure,
    type OrganizationStructure
} from './utils';

const STALE_TIME = 5000 as const;
const TREE_POLL_INTERVAL = 300_000 as const;

const organizationStructureQueryKey = ['org-tree'] as const;

const getOrganizationStructure = async (): Promise<OrganizationStructure> =>
    parseOrganizationStructure(await fetchJson('/api/org-tree'));

const useOrganizationStructure = () =>
    useQuery({
        queryKey: organizationStructureQueryKey,
        queryFn: getOrganizationStructure,
        staleTime: STALE_TIME,
        refetchInterval: ({ state }) =>
            getPollInterval(TREE_POLL_INTERVAL, state.fetchFailureCount)
    });

export { useOrganizationStructure, organizationStructureQueryKey };
