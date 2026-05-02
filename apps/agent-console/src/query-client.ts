import { QueryClient } from '@tanstack/react-query';

export const createBrowserQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: import.meta.env.DEV,
      },
    },
  });
