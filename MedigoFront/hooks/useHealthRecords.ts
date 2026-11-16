import { useEffect, useState } from 'react';
import { healthService } from '@/services/healthService';
import type { DailyProgress, HealthRecord } from '@/types/health';

type UseHealthRecordsResult = {
  records: HealthRecord[];
  progress: DailyProgress | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHealthRecords(): UseHealthRecordsResult {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextRecords, nextProgress] = await Promise.all([
        healthService.getRecords(),
        healthService.getDailyProgress(),
      ]);
      setRecords(nextRecords);
      setProgress(nextProgress);
    } catch {
      setError('Unable to load health records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    records,
    progress,
    isLoading,
    error,
    refresh,
  };
}
