import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { medicineService } from '@/services/medicineService';
import type { MedicineForm, MedicineInput } from '@/types/medicine';
import { scheduleMedicineReminders } from '@/utils/notifications';

type FormValues = {
  name: string;
  dosage: string;
  form: MedicineForm;
  frequency: string;
  reminderTimes: { value: string }[];
  startDate: string;
  endDate: string;
  quantity: string;
  notes: string;
};

const FORM_OPTIONS: MedicineForm[] = ['tablet', 'syrup', 'injection'];

const DEFAULT_TIMES = ['08:00', '14:00', '20:00', '22:00'];

function toDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export default function AddMedicineScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    dosage?: string;
    form?: string;
    quantity?: string;
    notes?: string;
    barcode?: string;
    familyMemberId?: string;
    familyMemberName?: string;
  }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const isEditing = Boolean(id);
  const familyMemberId =
    typeof params.familyMemberId === 'string' && params.familyMemberId.length > 0
      ? params.familyMemberId
      : undefined;
  const familyMemberName =
    typeof params.familyMemberName === 'string' ? params.familyMemberName : undefined;

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedFamilyMemberId, setLinkedFamilyMemberId] = useState<string | undefined>(
    familyMemberId,
  );
  const [pickerTarget, setPickerTarget] = useState<
    null | 'startDate' | 'endDate' | number
  >(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: typeof params.name === 'string' ? params.name : '',
      dosage: typeof params.dosage === 'string' ? params.dosage : '',
      form:
        params.form === 'tablet' || params.form === 'syrup' || params.form === 'injection'
          ? params.form
          : 'tablet',
      frequency: '1',
      reminderTimes: [{ value: '08:00' }],
      startDate: formatDate(new Date()),
      endDate: '',
      quantity: typeof params.quantity === 'string' ? params.quantity : '',
      notes:
        typeof params.notes === 'string'
          ? params.notes
          : typeof params.barcode === 'string'
            ? `Barcode: ${params.barcode}`
            : '',
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: 'reminderTimes',
  });

  const frequency = watch('frequency');
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  useEffect(() => {
    if (!id) {
      return;
    }

    let mounted = true;

    const loadMedicine = async () => {
      setIsLoading(true);
      try {
        const medicine = await medicineService.getById(id);
        if (!mounted || !medicine) {
          return;
        }

        reset({
          name: medicine.name,
          dosage: medicine.dosage,
          form: medicine.form,
          frequency: String(medicine.frequency),
          reminderTimes: medicine.reminderTimes.map((value) => ({ value })),
          startDate: medicine.startDate,
          endDate: medicine.endDate ?? '',
          quantity: String(medicine.quantity),
          notes: medicine.notes ?? '',
        });
        setLinkedFamilyMemberId(medicine.familyMemberId ?? familyMemberId);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadMedicine();

    return () => {
      mounted = false;
    };
  }, [id, reset]);

  useEffect(() => {
    const count = Math.max(1, Math.min(Number(frequency) || 1, 6));
    const current = watch('reminderTimes');
    if (current.length === count) {
      return;
    }

    if (current.length < count) {
      replace([
        ...current,
        ...Array.from({ length: count - current.length }, (_, index) => ({
          value: DEFAULT_TIMES[current.length + index] ?? '08:00',
        })),
      ]);
      return;
    }

    replace(current.slice(0, count));
  }, [frequency, replace, watch]);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setPickerTarget(null);
    }

    if (event.type === 'dismissed' || !selected) {
      if (Platform.OS === 'ios') {
        setPickerTarget(null);
      }
      return;
    }

    if (pickerTarget === 'startDate') {
      setValue('startDate', formatDate(selected), { shouldValidate: true });
    } else if (pickerTarget === 'endDate') {
      setValue('endDate', formatDate(selected), { shouldValidate: true });
    } else if (typeof pickerTarget === 'number') {
      setValue(`reminderTimes.${pickerTarget}.value`, formatTime(selected), {
        shouldValidate: true,
      });
    }

    if (Platform.OS === 'ios') {
      setPickerTarget(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload: MedicineInput = {
      name: values.name.trim(),
      dosage: values.dosage.trim(),
      form: values.form,
      frequency: Number(values.frequency),
      reminderTimes: values.reminderTimes.map((item) => item.value),
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      quantity: Number(values.quantity),
      notes: values.notes.trim() || undefined,
      familyMemberId: linkedFamilyMemberId,
    };

    setIsSubmitting(true);

    try {
      const saved = isEditing && id
        ? await medicineService.update(id, payload)
        : await medicineService.create(payload);

      try {
        await scheduleMedicineReminders({
          medicineId: saved.id,
          medicineName: saved.name,
          dosage: saved.dosage,
          reminderTimes: saved.reminderTimes,
        });
      } catch {
        // Local notifications are best-effort; medicine is already saved.
      }

      if (linkedFamilyMemberId) {
        router.replace(`/family/${linkedFamilyMemberId}` as Href);
      } else {
        router.replace('/(tabs)/medicines' as Href);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Please try again in a moment.';
      Alert.alert('Unable to save', message);
    } finally {
      setIsSubmitting(false);
    }
  });

  if (isLoading) {
    return (
      <LinearGradient colors={[Colors.mint, Colors.peach]} style={styles.loaderScreen}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[Colors.mint, Colors.peach]}
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.screenTitle}>{isEditing ? 'Edit Medicine' : 'Add Medicine'}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {linkedFamilyMemberId ? (
            <View style={styles.familyBanner}>
              <Ionicons name="people-outline" size={18} color={Colors.primary} />
              <Text style={styles.familyBannerText}>
                Tracking for {familyMemberName?.trim() || 'family member'}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push('/medicines/scan' as Href)}
            style={styles.scanButton}
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.primary} />
            <Text style={styles.scanButtonText}>Scan Barcode Instead</Text>
          </Pressable>

          <View style={styles.card}>
            <Controller
              control={control}
              name="name"
              rules={{ required: 'Medicine name is required.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Medicine Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. Metformin"
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="dosage"
              rules={{ required: 'Dosage is required.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Dosage"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. 500 mg"
                  error={errors.dosage?.message}
                />
              )}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Form</Text>
              <Controller
                control={control}
                name="form"
                rules={{ required: true }}
                render={({ field: { value, onChange } }) => (
                  <View style={styles.chips}>
                    {FORM_OPTIONS.map((option) => {
                      const selected = value === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => onChange(option)}
                          style={[styles.chip, selected && styles.chipSelected]}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
            </View>

            <Controller
              control={control}
              name="frequency"
              rules={{
                required: 'Frequency is required.',
                validate: (value) => {
                  const num = Number(value);
                  if (!Number.isInteger(num) || num < 1 || num > 6) {
                    return 'Enter a frequency between 1 and 6.';
                  }
                  return true;
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Frequency (times per day)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  placeholder="1"
                  error={errors.frequency?.message}
                />
              )}
            />

            <View style={styles.fieldBlock}>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Reminder Times</Text>
                <Pressable
                  onPress={() => {
                    const next = Math.min(6, (Number(frequency) || 1) + 1);
                    setValue('frequency', String(next));
                  }}
                >
                  <Text style={styles.addTime}>+ Add</Text>
                </Pressable>
              </View>

              {fields.map((field, index) => (
                <Controller
                  key={field.id}
                  control={control}
                  name={`reminderTimes.${index}.value`}
                  rules={{
                    required: 'Reminder time is required.',
                    pattern: {
                      value: /^([01]\d|2[0-3]):([0-5]\d)$/,
                      message: 'Use HH:MM format.',
                    },
                  }}
                  render={({ field: { value } }) => (
                    <View style={styles.timeRow}>
                      <Pressable
                        style={styles.timeButton}
                        onPress={() => setPickerTarget(index)}
                      >
                        <Ionicons name="time-outline" size={18} color={Colors.primary} />
                        <Text style={styles.timeText}>{value}</Text>
                      </Pressable>
                      {fields.length > 1 ? (
                        <Pressable
                          onPress={() => {
                            const current = watch('reminderTimes');
                            const next = current.filter((_, itemIndex) => itemIndex !== index);
                            replace(next);
                            setValue('frequency', String(next.length));
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={22} color={Colors.error} />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                />
              ))}
              {errors.reminderTimes ? (
                <Text style={styles.errorText}>Please set valid reminder times.</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Start Date</Text>
              <Pressable style={styles.dateButton} onPress={() => setPickerTarget('startDate')}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.timeText}>{startDate}</Text>
              </Pressable>
              {errors.startDate ? (
                <Text style={styles.errorText}>{errors.startDate.message}</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>End Date</Text>
              <Pressable style={styles.dateButton} onPress={() => setPickerTarget('endDate')}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.timeText}>{endDate || 'Optional'}</Text>
              </Pressable>
            </View>

            <Controller
              control={control}
              name="startDate"
              rules={{ required: 'Start date is required.' }}
              render={() => <View />}
            />

            <Controller
              control={control}
              name="quantity"
              rules={{
                required: 'Quantity is required.',
                validate: (value) =>
                  Number(value) > 0 || 'Enter a quantity greater than 0.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Quantity"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  placeholder="30"
                  error={errors.quantity?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Notes"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Optional instructions"
                  multiline
                  style={styles.notesInput}
                />
              )}
            />

            <Pressable
              onPress={onSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !isSubmitting ? styles.submitPressed : null,
                isSubmitting ? styles.submitDisabled : null,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>
                  {isEditing ? 'Save Changes' : 'Save Medicine'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerTarget !== null ? (
        <View style={styles.pickerSheet}>
          <DateTimePicker
            value={
              pickerTarget === 'startDate'
                ? toDate(startDate)
                : pickerTarget === 'endDate'
                  ? toDate(endDate || startDate)
                  : timeToDate(fields[pickerTarget]?.value ?? '08:00')
            }
            mode={pickerTarget === 'startDate' || pickerTarget === 'endDate' ? 'date' : 'time'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
            themeVariant="light"
            textColor={Colors.text}
            accentColor={Colors.primary}
          />
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loaderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  familyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  familyBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  scanButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.chipInactive,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addTime: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  timeText: {
    fontSize: 16,
    color: Colors.text,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitPressed: {
    opacity: 0.9,
  },
  submitDisabled: {
    opacity: 0.8,
  },
  submitText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 8,
  },
});
