import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { appointmentService } from '@/services/appointmentService';
import type { CreateAppointmentInput } from '@/types/appointment';
import {
  cancelAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/utils/notifications';

type FormValues = {
  doctorName: string;
  specialty: string;
  clinic: string;
  date: Date;
  time: Date;
  reason: string;
  reminderEnabled: boolean;
};

const SPECIALTIES = [
  'General Physician',
  'Cardiologist',
  'Endocrinologist',
  'Orthopedist',
  'Dermatologist',
  'Pediatrician',
  'Neurologist',
  'Gynecologist',
  'ENT',
  'Other',
] as const;

function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AddAppointmentScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [showSpecialtyList, setShowSpecialtyList] = useState(false);

  const defaultTime = new Date();
  defaultTime.setHours(10, 0, 0, 0);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      doctorName: '',
      specialty: 'General Physician',
      clinic: '',
      date: new Date(),
      time: defaultTime,
      reason: '',
      reminderEnabled: true,
    },
  });

  const date = watch('date');
  const time = watch('time');
  const specialty = watch('specialty');
  const reminderEnabled = watch('reminderEnabled');

  useEffect(() => {
    if (!id) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setFormError(null);
      try {
        const appointment = await appointmentService.getById(id);
        if (!mounted) {
          return;
        }

        const startsAt = new Date(appointment.date || appointment.startsAt);
        reset({
          doctorName: appointment.doctorName,
          specialty: appointment.specialty,
          clinic: appointment.clinic,
          date: startsAt,
          time: startsAt,
          reason: appointment.notes ?? '',
          reminderEnabled: appointment.reminderEnabled ?? true,
        });
      } catch {
        if (mounted) {
          setFormError('Unable to load this appointment.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [id, reset]);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode(null);
    }

    if (event.type === 'dismissed' || !selected) {
      if (Platform.OS === 'ios') {
        setPickerMode(null);
      }
      return;
    }

    if (pickerMode === 'date') {
      setValue('date', selected, { shouldValidate: true });
    } else if (pickerMode === 'time') {
      setValue('time', selected, { shouldValidate: true });
    }

    if (Platform.OS === 'ios') {
      setPickerMode(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const startsAt = combineDateAndTime(values.date, values.time);
    if (startsAt.getTime() <= Date.now()) {
      setFormError('Please choose a future date and time.');
      return;
    }

    const payload: CreateAppointmentInput = {
      doctorName: values.doctorName.trim(),
      specialty: values.specialty,
      clinic: values.clinic.trim(),
      startsAt: startsAt.toISOString(),
      notes: values.reason.trim() || undefined,
      reminderEnabled: values.reminderEnabled,
    };

    setIsSubmitting(true);

    try {
      const saved =
        isEditing && id
          ? await appointmentService.update(id, payload)
          : await appointmentService.create(payload);

      if (values.reminderEnabled) {
        await scheduleAppointmentReminder({
          appointmentId: saved.id,
          doctorName: saved.doctorName,
          clinic: saved.clinic,
          startsAt: saved.startsAt,
        });
      } else {
        await cancelAppointmentReminder(saved.id);
      }

      router.replace('/(tabs)/appointments' as Href);
    } catch {
      setFormError('Unable to save appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>
          {isEditing ? 'Edit Appointment' : 'Book Appointment'}
        </Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            {isEditing ? 'Update visit details' : 'Schedule a visit'}
          </Text>
          <Text style={styles.subtitle}>
            Fill in the doctor and timing details. Enable reminder to get notified before the visit.
          </Text>

          <View style={styles.card}>
            <Controller
              control={control}
              name="doctorName"
              rules={{ required: 'Doctor name is required.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Doctor Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Dr. Smith"
                  error={errors.doctorName?.message}
                />
              )}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Specialty</Text>
              <Pressable
                style={styles.dropdown}
                onPress={() => setShowSpecialtyList((current) => !current)}
              >
                <Text style={styles.dropdownText}>{specialty}</Text>
                <Ionicons
                  name={showSpecialtyList ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textSecondary}
                />
              </Pressable>
              {showSpecialtyList ? (
                <View style={styles.dropdownList}>
                  {SPECIALTIES.map((option) => {
                    const selected = specialty === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setValue('specialty', option, { shouldValidate: true });
                          setShowSpecialtyList(false);
                        }}
                        style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            selected && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Controller
                control={control}
                name="specialty"
                rules={{ required: 'Specialty is required.' }}
                render={() => <View />}
              />
            </View>

            <Controller
              control={control}
              name="clinic"
              rules={{ required: 'Clinic or hospital is required.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Clinic / Hospital"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="City Wellness Center"
                  error={errors.clinic?.message}
                />
              )}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Date</Text>
              <Pressable style={styles.pickerButton} onPress={() => setPickerMode('date')}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.pickerText}>{formatDate(date)}</Text>
              </Pressable>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Time</Text>
              <Pressable style={styles.pickerButton} onPress={() => setPickerMode('time')}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.pickerText}>{formatTime(time)}</Text>
              </Pressable>
            </View>

            <Controller
              control={control}
              name="reason"
              rules={{ required: 'Reason for visit is required.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Reason for Visit"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Describe the reason for this appointment"
                  multiline
                  style={styles.reasonInput}
                  error={errors.reason?.message}
                />
              )}
            />

            <View style={styles.reminderRow}>
              <View style={styles.reminderCopy}>
                <Text style={styles.label}>Reminder</Text>
                <Text style={styles.reminderHint}>
                  Notify me 1 hour before the appointment
                </Text>
              </View>
              <Controller
                control={control}
                name="reminderEnabled"
                render={({ field: { value, onChange } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: Colors.border, true: Colors.mint }}
                    thumbColor={value ? Colors.primary : Colors.white}
                  />
                )}
              />
            </View>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !isSubmitting ? styles.pressed : null,
                isSubmitting ? styles.disabled : null,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>
                  {isEditing ? 'Save Changes' : 'Book Appointment'}
                </Text>
              )}
            </Pressable>

            {reminderEnabled ? (
              <Text style={styles.footerNote}>
                A local notification will be scheduled when you save.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerMode ? (
        <View style={styles.pickerSheet}>
          <DateTimePicker
            value={pickerMode === 'date' ? date : time}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
            themeVariant="light"
            textColor={Colors.text}
            accentColor={Colors.primary}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginTop: -8,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.mint,
  },
  dropdownItemText: {
    fontSize: 15,
    color: Colors.text,
  },
  dropdownItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  pickerButton: {
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
  pickerText: {
    fontSize: 16,
    color: Colors.text,
  },
  reasonInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  reminderCopy: {
    flex: 1,
    gap: 2,
  },
  reminderHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.75,
  },
});
