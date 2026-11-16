import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { medicineService } from '@/services/medicineService';
import type { Medicine, Reminder } from '@/types/medicine';

type UseMedicinesResult = {
  medicines: Medicine[];
  reminders: Reminder[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markReminderTaken: (reminderId: string) => Promise<void>;
};

function toReminders(medicines: Medicine[]): Reminder[] {
  return medicines
    .filter((medicine) => medicine.nextReminderTime)
    .map((medicine) => ({
      id: `reminder-${medicine.id}`,
      medicineId: medicine.id,
      medicineName: medicine.name,
      dosage: medicine.dosage,
      time: medicine.nextReminderTime as string,
      taken: medicine.takenToday,
    }));
}

export function useMedicines(): UseMedicinesResult {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await medicineService.getAll();
      setMedicines(data);
    } catch {
      setMedicines([]);
      setError('Unable to load medicines.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const markReminderTaken = async (reminderId: string) => {
    const medicineId = reminderId.replace('reminder-', '');

    setMedicines((current) =>
      current.map((medicine) =>
        medicine.id === medicineId ? { ...medicine, takenToday: true } : medicine,
      ),
    );

    await medicineService.markTaken(medicineId);
  };

  return {
    medicines,
    reminders: toReminders(medicines),
    isLoading,
    error,
    refresh,
    markReminderTaken,
  };
}
