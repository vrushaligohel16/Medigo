import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from '@/components/InputField';
import { TagsInput } from '@/components/TagsInput';
import { Colors } from '@/constants/colors';
import { familyService } from '@/services/familyService';
import type {
  BloodGroup,
  CreateFamilyMemberInput,
  FamilyRelation,
} from '@/types/family';

type FormValues = {
  name: string;
  relation: FamilyRelation;
  age: string;
  photoUri: string;
  bloodGroup: BloodGroup | '';
  allergies: string[];
  chronicConditions: string[];
};

const RELATIONS: FamilyRelation[] = [
  'Self',
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Other',
];

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function AddFamilyMemberScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showRelationList, setShowRelationList] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      relation: 'Other',
      age: '',
      photoUri: '',
      bloodGroup: '',
      allergies: [],
      chronicConditions: [],
    },
  });

  const relation = watch('relation');
  const photoUri = watch('photoUri');
  const bloodGroup = watch('bloodGroup');

  useEffect(() => {
    if (!id) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setFormError(null);
      try {
        const member = await familyService.getById(id);
        if (!mounted) {
          return;
        }

        reset({
          name: member.name,
          relation: member.relation,
          age: member.age != null ? String(member.age) : '',
          photoUri: member.avatarUrl ?? '',
          bloodGroup: member.bloodGroup ?? '',
          allergies: member.allergies ?? [],
          chronicConditions: member.chronicConditions ?? [],
        });
      } catch {
        if (mounted) {
          setFormError('Unable to load this family member.');
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

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormError('Photo library permission is required to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setValue('photoUri', result.assets[0].uri, { shouldValidate: true });
      setFormError(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload: CreateFamilyMemberInput = {
      name: values.name.trim(),
      relation: values.relation,
      photoUri: values.photoUri || undefined,
      avatarUrl: values.photoUri || undefined,
      age: values.age ? Number(values.age) : undefined,
      bloodGroup: values.bloodGroup || undefined,
      allergies: values.allergies,
      chronicConditions: values.chronicConditions,
    };

    setIsSubmitting(true);

    try {
      const saved =
        isEditing && id
          ? await familyService.update(id, payload)
          : await familyService.create(payload);

      router.replace(`/family/${saved.id}` as Href);
    } catch {
      setFormError('Unable to save family member. Please try again.');
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
          {isEditing ? 'Edit Family Member' : 'Add Family Member'}
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
            {isEditing ? 'Update profile' : 'New family profile'}
          </Text>
          <Text style={styles.subtitle}>
            Add health details so MediGo can personalize care for this member.
          </Text>

          <View style={styles.card}>
            <View style={styles.photoBlock}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Ionicons name="person" size={32} color={Colors.primary} />
                </View>
              )}
              <Pressable onPress={() => void pickPhoto()} style={styles.photoButton}>
                <Ionicons name="camera-outline" size={16} color={Colors.primary} />
                <Text style={styles.photoButtonText}>
                  {photoUri ? 'Change Photo' : 'Upload Photo'}
                </Text>
              </Pressable>
            </View>

            <Controller
              control={control}
              name="name"
              rules={{ required: 'Name is required.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Full name"
                  error={errors.name?.message}
                />
              )}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Relation</Text>
              <Pressable
                style={styles.dropdown}
                onPress={() => setShowRelationList((current) => !current)}
              >
                <Text style={styles.dropdownText}>{relation}</Text>
                <Ionicons
                  name={showRelationList ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textSecondary}
                />
              </Pressable>
              {showRelationList ? (
                <View style={styles.dropdownList}>
                  {RELATIONS.map((option) => {
                    const selected = relation === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setValue('relation', option, { shouldValidate: true });
                          setShowRelationList(false);
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
            </View>

            <Controller
              control={control}
              name="age"
              rules={{
                validate: (value) =>
                  !value || Number(value) > 0 || 'Enter a valid age.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Age"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  placeholder="35"
                  error={errors.age?.message}
                />
              )}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Blood Group</Text>
              <View style={styles.chips}>
                {BLOOD_GROUPS.map((option) => {
                  const selected = bloodGroup === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setValue('bloodGroup', option)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Controller
              control={control}
              name="allergies"
              render={({ field: { value, onChange } }) => (
                <TagsInput
                  label="Allergies"
                  value={value}
                  onChange={onChange}
                  placeholder="e.g. Penicillin"
                />
              )}
            />

            <Controller
              control={control}
              name="chronicConditions"
              render={({ field: { value, onChange } }) => (
                <TagsInput
                  label="Chronic Conditions"
                  value={value}
                  onChange={onChange}
                  placeholder="e.g. Diabetes"
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
                <Text style={styles.submitText}>
                  {isEditing ? 'Save Changes' : 'Add Member'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  photoBlock: {
    alignItems: 'center',
    gap: 10,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Colors.mint,
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.mint,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  photoButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.chipInactive,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    fontSize: 13,
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
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.75,
  },
});
