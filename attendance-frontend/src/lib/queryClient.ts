import { QueryClient } from '@tanstack/react-query'
import { parseApiError } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        const k = parseApiError(err).kind
        return (k === 'server' || k === 'network') && count < 1
      },
    },
  },
})

/** Invalidate every query whose key starts with one of the given names. */
export const invalidate = (qc: QueryClient, ...names: string[]) =>
  Promise.all(names.map((n) => qc.invalidateQueries({ queryKey: [n] })))
