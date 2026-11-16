import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { emergencyContactService } from '@/services/emergencyContactService';
import type { EmergencyContact } from '@/types/emergency';

type FormValues = {
  name: string;
  phone: string;
  relation: string;
};

export default function ManageEmergencyContactsScreen() {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '', phone: '', relation: '' },
  });

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await emergencyContactService.getAll();
      setContacts(data);
    } catch {
      setContacts([]);
      setError('Unable to load emergency contacts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadContacts();
    }, [loadContacts]),
  );

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({ name: '', phone: '', relation: '' });
    setFormVisible(true);
  };

  const openEdit = (contact: EmergencyContact) => {
    setEditing(contact);
    setError(null);
    reset({
      name: contact.name,
      phone: contact.phone,
      relation: contact.relation ?? '',
    });
    setFormVisible(true);
  };

  const onSave = handleSubmit(async (values) => {
    setIsSaving(true);
    setError(null);
    try {
      if (editing) {
        await emergencyContactService.update(editing.id, values);
      } else {
        await emergencyContactService.create(values);
      }
      setFormVisible(false);
      await loadContacts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save emergency contact.',
      );
    } finally {
      setIsSaving(false);
    }
  });

  const onDelete = (contact: EmergencyContact) => {
    Alert.alert(
      'Remove contact',
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await emergencyContactService.delete(contact.id);
                await loadContacts();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Unable to delete emergency contact.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Contacts</Text>
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {error && !formVisible ? (
        <Text style={styles.errorBanner}>{error}</Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            contacts.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-add-outline" size={36} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No emergency contacts</Text>
              <Text style={styles.emptyBody}>
                Add trusted people who should receive SOS alerts.
              </Text>
              <Pressable
                onPress={openCreate}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Add contact</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.initial}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.relation ? `${item.relation} · ` : ''}
                  {item.phone}
                </Text>
              </View>
              <Pressable
                onPress={() => openEdit(item)}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSaving) {
            setFormVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!isSaving) {
                setFormVisible(false);
              }
            }}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <Text style={styles.sheetTitle}>
              {editing ? 'Edit contact' : 'Add contact'}
            </Text>

            <Controller
              control={control}
              name="name"
              rules={{ required: 'Name is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Name"
                  placeholder="Full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              rules={{
                required: 'Phone is required',
                minLength: { value: 7, message: 'Enter a valid phone number' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Phone"
                  placeholder="+91..."
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="relation"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="Relation (optional)"
                  placeholder="Spouse, Doctor, Family..."
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            {error && formVisible ? (
              <Text style={styles.formError}>{error}</Text>
            ) : null}

            <View style={styles.sheetActions}>
              <Pressable
                disabled={isSaving}
                onPress={() => setFormVisible(false)}
                style={({ pressed }) => [
                  styles.sheetBtn,
                  styles.sheetCancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={() => void onSave()}
                style={({ pressed }) => [
                  styles.sheetBtn,
                  styles.sheetSave,
                  pressed && styles.pressed,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.sheetSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  errorBanner: {
    color: Colors.error,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 13,
  },
  formError: {
    color: Colors.error,
    textAlign: 'center',
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,26,0.4)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  sheetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancel: {
    backgroundColor: Colors.chipInactive,
  },
  sheetCancelText: {
    fontWeight: '600',
    color: Colors.text,
  },
  sheetSave: {
    backgroundColor: Colors.primary,
  },
  sheetSaveText: {
    fontWeight: '700',
    color: Colors.white,
  },
  pressed: {
    opacity: 0.75,
  },
});
