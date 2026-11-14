import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../api/library';

export function useWatchHistory() {
  const { data: continueWatching = [], isLoading } = useQuery({
    queryKey: ['library', 'continue-watching'],
    queryFn: libraryApi.getContinueWatching,
  });

  return { continueWatching, isLoading };
}
