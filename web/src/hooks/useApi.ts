import useSWR, { SWRConfiguration } from 'swr';
import { api } from '@/lib/api';

export function useApi<T>(url: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(url, (u: string) => api.get(u).then((r) => r.data.data), config);
}
