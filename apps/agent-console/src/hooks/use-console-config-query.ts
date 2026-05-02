import { useQuery } from '@tanstack/react-query';

import { fetchConfigEnvelope } from '~/api/config';
import { queryKeys } from '~/api/query-keys';

export const useConsoleConfigQuery = () =>
  useQuery({
    queryKey: queryKeys.config(),
    queryFn: fetchConfigEnvelope,
    staleTime: 30_000,
    retry: 1,
  });
