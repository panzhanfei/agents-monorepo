import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '~/api/query-keys';

/** 在完成写盘等操作后失效编排配置缓存 */
export const useInvalidateConsoleConfig = (): {
  invalidate: () => Promise<void>;
} => {
  const qc = useQueryClient();

  const invalidate = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.config() });
  }, [qc]);

  return { invalidate };
};
