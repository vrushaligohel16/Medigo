import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { emergencyContactService } from '@/services/emergencyContactService';
import type { EmergencyContact } from '@/types/emergency';
import { notifyEmergencyAlertSent } from '@/utils/notifications';

const SOS_COLOR = Colors.danger;

export default function SosScreen() {
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'ok' | 'error'>('ok');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setIsLoading(true);
        try {
          const data = await emergencyContactService.getAll();
          if (active) {
            setContacts(data);
            setStatusMessage(null);
          }
        } catch {
          if (active) {
            setContacts([]);
            setStatusTone('error');
            setStatusMessage('Unable to load emergency contacts.');
          }
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      };

      void load();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });
  const buttonScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const onPressSos = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setStatusMessage(null);
    setConfirmVisible(true);
  };

  const sendEmergencyAlert = async () => {
    setIsSending(true);
    setStatusMessage(null);

    try {
      if (contacts.length === 0) {
        setStatusTone('error');
        setStatusMessage('Add at least one emergency contact first.');
        setConfirmVisible(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setStatusTone('error');
        setStatusMessage('Location permission is required to send your position.');
        setConfirmVisible(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, accuracy } = position.coords;

      const result = await emergencyContactService.triggerSos({
        latitude,
        longitude,
        accuracy: accuracy ?? undefined,
      });

      setConfirmVisible(false);

      if (!result.configured || !result.ok) {
        setStatusTone('error');
        setStatusMessage(result.message);
        return;
      }

      await notifyEmergencyAlertSent({
        contactCount: result.sentCount ?? contacts.length,
        mapsLink: `https://maps.google.com/?q=${latitude},${longitude}`,
      });

      setStatusTone('ok');
      setStatusMessage(result.message);
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Could not send the emergency alert. Please try again.',
      );
      setConfirmVisible(false);
    } finally {
      setIsSending(false);
    }
  };

  const callContact = async (phone: string) => {
    const url = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
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
        <Text style={styles.headerTitle}>Emergency SOS</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Press the button only in a real emergency. Your location will be shared with
          saved contacts via the server SMS provider.
        </Text>

        <View style={styles.sosArea}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Pressable
              onPress={() => void onPressSos()}
              disabled={isSending}
              accessibilityRole="button"
              accessibilityLabel="Send emergency SOS"
              style={({ pressed }) => [
                styles.sosButton,
                pressed && styles.sosButtonPressed,
              ]}
            >
              <Text style={styles.sosLabel}>SOS</Text>
              <Text style={styles.sosHint}>Hold & press</Text>
            </Pressable>
          </Animated.View>
        </View>

        {statusMessage ? (
          <View
            style={[
              styles.statusBanner,
              statusTone === 'ok' ? styles.statusOk : styles.statusError,
            ]}
          >
            <Ionicons
              name={statusTone === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={statusTone === 'ok' ? Colors.primary : SOS_COLOR}
            />
            <Text
              style={[
                styles.statusText,
                statusTone === 'error' && { color: SOS_COLOR },
              ]}
            >
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.contactsHeader}>
          <Text style={styles.sectionTitle}>Emergency contacts</Text>
          <Pressable
            onPress={() => router.push('/sos/contacts' as Href)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.manageLink}>Manage Contacts</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
        ) : contacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={28} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No contacts saved</Text>
            <Text style={styles.emptyBody}>
              Add people who should receive your emergency alerts.
            </Text>
            <Pressable
              onPress={() => router.push('/sos/contacts' as Href)}
              style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
            >
              <Text style={styles.emptyCtaText}>Manage Contacts</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.contactList}>
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactInitial}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactBody}>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {contact.name}
                  </Text>
                  <Text style={styles.contactMeta} numberOfLines={1}>
                    {contact.relation ? `${contact.relation} · ` : ''}
                    {contact.phone}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void callContact(contact.phone)}
                  accessibilityLabel={`Call ${contact.name}`}
                  style={({ pressed }) => [
                    styles.callBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="call" size={20} color={Colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSending) {
            setConfirmVisible(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={28} color={SOS_COLOR} />
            </View>
            <Text style={styles.modalTitle}>
              Send emergency alert to your contacts?
            </Text>
            <Text style={styles.modalBody}>
              Your current location will be sent to the server with your saved contacts.
              SMS delivery requires Twilio credentials on the backend.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                disabled={isSending}
                onPress={() => setConfirmVisible(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalCancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSending}
                onPress={() => void sendEmergencyAlert()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalConfirm,
                  pressed && styles.pressed,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Send alert</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.mint,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    gap: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sosArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
    marginVertical: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: SOS_COLOR,
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: SOS_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SOS_COLOR,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sosButtonPressed: {
    opacity: 0.9,
  },
  sosLabel: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
  },
  sosHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  statusOk: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusError: {
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: Colors.interactionSevereBg,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  contactsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  manageLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  contactList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.chipInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  contactBody: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  contactMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyCta: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  emptyCtaText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 22,
    gap: 10,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.interactionSevereBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancel: {
    backgroundColor: Colors.chipInactive,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  modalConfirm: {
    backgroundColor: SOS_COLOR,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  pressed: {
    opacity: 0.75,
  },
});
