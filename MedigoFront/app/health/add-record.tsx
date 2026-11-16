import { useState } from 'react';
import {
  ActivityIndicator,
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
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { healthService } from '@/services/healthService';
import type { HealthMetricType, SugarContext } from '@/types/health';

type FormValues = {
  type: HealthMetricType;
  systolic: string;
  diastolic: string;
  sugarValue: string;
  sugarContext: SugarContext;
  weight: string;
  water: string;
  notes: string;
  recordedAt: Date;
};

const TYPE_OPTIONS: { key: HealthMetricType; label: string }[] = [
  { key: 'bp', label: 'BP' },
  { key: 'sugar', label: 'Sugar' },
  { key: 'weight', label: 'Weight' },
  { key: 'water', label: 'Water' },
];

function parseTypeParam(value: string | string[] | undefined): HealthMetricType {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'bp' || raw === 'sugar' || raw === 'weight' || raw === 'water') {
    return raw;
  }
  return 'bp';
}

export default function AddHealthRecordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = parseTypeParam(params.type);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      type: initialType,
      systolic: '',
      diastolic: '',
      sugarValue: '',
      sugarContext: 'fasting',
      weight: '',
      water: '250',
      notes: '',
      recordedAt: new Date(),
    },
  });

  const type = watch('type');
  const water = watch('water');
  const recordedAt = watch('recordedAt');

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'dismissed') {
      if (Platform.OS === 'ios') {
        setShowPicker(false);
      }
      return;
    }
    if (selected) {
      setValue('recordedAt', selected, { shouldValidate: true });
    }
    if (Platform.OS === 'ios') {
      setShowPicker(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (values.type === 'bp') {
        await healthService.addRecord({
          type: 'bp',
          systolic: Number(values.systolic),
          diastolic: Number(values.diastolic),
          recordedAt: values.recordedAt.toISOString(),
          notes: values.notes.trim() || undefined,
        });
      } else if (values.type === 'sugar') {
        await healthService.addRecord({
          type: 'sugar',
          value: Number(values.sugarValue),
          sugarContext: values.sugarContext,
          recordedAt: values.recordedAt.toISOString(),
          notes: values.notes.trim() || undefined,
        });
      } else if (values.type === 'weight') {
        await healthService.addRecord({
          type: 'weight',
          value: Number(values.weight),
          recordedAt: values.recordedAt.toISOString(),
          notes: values.notes.trim() || undefined,
        });
      } else {
        await healthService.addRecord({
          type: 'water',
          value: Number(values.water),
          recordedAt: values.recordedAt.toISOString(),
          notes: values.notes.trim() || undefined,
        });
      }

      router.replace(`/health/history?metric=${values.type}` as Href);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to save record. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Log Health</Text>
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
          <Text style={styles.title}>Add Health Record</Text>
          <Text style={styles.subtitle}>Choose a metric and enter today’s reading.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Type</Text>
            <Controller
              control={control}
              name="type"
              render={({ field: { value, onChange } }) => (
                <View style={styles.typeRow}>
                  {TYPE_OPTIONS.map((option) => {
                    const selected = value === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => onChange(option.key)}
                        style={[styles.typeChip, selected && styles.typeChipSelected]}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            selected && styles.typeChipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />

            {type === 'bp' ? (
              <View style={styles.bpRow}>
                <View style={styles.flex}>
                  <Controller
                    control={control}
                    name="systolic"
                    rules={{
                      required: 'Systolic is required.',
                      validate: (value) =>
                        Number(value) > 0 || 'Enter a valid systolic value.',
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <InputField
                        label="Systolic"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="number-pad"
                        placeholder="120"
                        error={errors.systolic?.message}
                      />
                    )}
                  />
                </View>
                <View style={styles.flex}>
                  <Controller
                    control={control}
                    name="diastolic"
                    rules={{
                      required: 'Diastolic is required.',
                      validate: (value) =>
                        Number(value) > 0 || 'Enter a valid diastolic value.',
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <InputField
                        label="Diastolic"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="number-pad"
                        placeholder="80"
                        error={errors.diastolic?.message}
                      />
                    )}
                  />
                </View>
              </View>
            ) : null}

            {type === 'sugar' ? (
              <>
                <Controller
                  control={control}
                  name="sugarValue"
                  rules={{
                    required: 'Blood sugar is required.',
                    validate: (value) => Number(value) > 0 || 'Enter a valid reading.',
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <InputField
                      label="Blood Sugar (mg/dL)"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                      placeholder="100"
                      error={errors.sugarValue?.message}
                    />
                  )}
                />
                <Text style={styles.label}>Context</Text>
                <Controller
                  control={control}
                  name="sugarContext"
                  render={({ field: { value, onChange } }) => (
                    <View style={styles.typeRow}>
                      {(['fasting', 'post-meal'] as SugarContext[]).map((option) => {
                        const selected = value === option;
                        return (
                          <Pressable
                            key={option}
                            onPress={() => onChange(option)}
                            style={[styles.typeChip, selected && styles.typeChipSelected]}
                          >
                            <Text
                              style={[
                                styles.typeChipText,
                                selected && styles.typeChipTextSelected,
                              ]}
                            >
                              {option === 'fasting' ? 'Fasting' : 'Post-meal'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                />
              </>
            ) : null}

            {type === 'weight' ? (
              <Controller
                control={control}
                name="weight"
                rules={{
                  required: 'Weight is required.',
                  validate: (value) => Number(value) > 0 || 'Enter a valid weight.',
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <InputField
                    label="Weight (kg)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    placeholder="68.5"
                    error={errors.weight?.message}
                  />
                )}
              />
            ) : null}

            {type === 'water' ? (
              <>
                <Controller
                  control={control}
                  name="water"
                  rules={{
                    required: 'Water amount is required.',
                    validate: (value) => Number(value) > 0 || 'Enter a valid amount.',
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <InputField
                      label="Water (ml)"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="number-pad"
                      placeholder="250"
                      error={errors.water?.message}
                    />
                  )}
                />
                <View style={styles.quickRow}>
                  {[250, 500, 750].map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() =>
                        setValue('water', String((Number(water) || 0) + amount), {
                          shouldValidate: true,
                        })
                      }
                      style={styles.quickChip}
                    >
                      <Text style={styles.quickChipText}>+{amount} ml</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Date & Time</Text>
              <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.dateText}>{recordedAt.toLocaleString()}</Text>
              </Pressable>
            </View>

            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Notes (optional)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Any extra details"
                  multiline
                  style={styles.notes}
                />
              )}
            />

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
                <Text style={styles.submitText}>Save Record</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showPicker ? (
        <View style={styles.pickerSheet}>
          <DateTimePicker
            value={recordedAt}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.chipInactive,
  },
  typeChipSelected: {
    backgroundColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  typeChipTextSelected: {
    color: Colors.white,
  },
  bpRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -4,
  },
  quickChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.mint,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  fieldBlock: {
    gap: 8,
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
  dateText: {
    fontSize: 15,
    color: Colors.text,
  },
  notes: {
    minHeight: 88,
    textAlignVertical: 'top',
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
