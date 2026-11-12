import { QueryClient } from '@tanstack/react-query';

/** In-memory only (no persister): cached server data disappears with the process and on logout (T164). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 }, // control commands are never retried blindly
  },
});
