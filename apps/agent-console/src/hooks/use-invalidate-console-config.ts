import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '~/api/query-keys';

export const useInvalidateConsoleConfig = (): {
  invalidate: () => Promise<void>;
} => {
  const qc = useQueryClient();

  const invalidate = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.config() });
    await qc.invalidateQueries({
      queryKey: [...queryKeys.root, 'target-ai-rules'],
    });
  }, [qc]);

  return { invalidate };
};
