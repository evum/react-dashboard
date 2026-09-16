import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    applyOrganizationChanges,
    fetchJson,
    getPollInterval,
    parseOrganizationChanges,
    type OrganizationChanges,
    type OrganizationStructure
} from './utils';
import { organizationStructureQueryKey } from './GetOrganizationStructure';

const organizationChangesQueryKey = ['org-tree-changes'] as const;
const PATCH_POLL_INTERVAL = 5000 as const;

const getOrganizationChanges = async (
    since: number
): Promise<OrganizationChanges> =>
    parseOrganizationChanges(
        await fetchJson(`/api/org-tree/changes?since=${since}`)
    );

const useOrganizationChanges = () => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: organizationChangesQueryKey,
        queryFn: async () => {
            const structure = queryClient.getQueryData<OrganizationStructure>(
                organizationStructureQueryKey
            );

            if (!structure) {
                return null;
            }

            const changes = await getOrganizationChanges(structure.version);

            if (changes.reset) {
                await queryClient.invalidateQueries({
                    queryKey: organizationStructureQueryKey
                });

                return changes.version;
            }

            if (changes.changed.length > 0) {
                queryClient.setQueryData(
                    organizationStructureQueryKey,
                    applyOrganizationChanges(structure, changes)
                );
            }

            return changes.version;
        },
        retry: 0,
        refetchInterval: ({ state }) =>
            getPollInterval(PATCH_POLL_INTERVAL, state.fetchFailureCount)
    });
};

export { useOrganizationChanges, organizationChangesQueryKey };
