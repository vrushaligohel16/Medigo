import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { AuthError, authService } from '@/services/authService';

type SettingsItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: Href;
  danger?: boolean;
  onPress?: () => void;
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user, refreshUser, updateUser, isLoading: authLoading } = useAuth();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Quiet background refresh — keep showing cached user so the hero does not flicker.
  useFocusEffect(
    useCallback(() => {
      void refreshUser();
    }, [refreshUser]),
  );

  const pickAndUploadAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to set your profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const updated = await authService.uploadAvatar(asset.uri, {
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      await updateUser(updated);
    } catch (error) {
      const message =
        error instanceof AuthError
          ? error.message
          : 'Unable to upload profile photo. Please try again.';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert('Profile photo', 'Choose a photo for your MediGo profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose Photo', onPress: () => void pickAndUploadAvatar() },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout()
            .catch(() => undefined)
            .finally(() => {
              if (router.canDismiss()) {
                router.dismissAll();
              }
              router.replace('/(auth)/login' as Href);
            });
        },
      },
    ]);
  };

  const settings: SettingsItem[] = [
    {
      key: 'notifications',
      label: 'Notification Preferences',
      icon: 'notifications-outline',
      href: '/profile/notifications' as Href,
    },
    {
      key: 'emergency',
      label: 'Emergency Contacts',
      icon: 'call-outline',
      href: '/sos/contacts' as Href,
    },
    {
      key: 'family',
      label: 'Family Members',
      icon: 'people-outline',
      href: '/family' as Href,
    },
    {
      key: 'password',
      label: 'Change Password',
      icon: 'lock-closed-outline',
      href: '/profile/change-password' as Href,
    },
    {
      key: 'privacy',
      label: 'Privacy Policy',
      icon: 'shield-checkmark-outline',
      href: '/profile/privacy' as Href,
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: 'log-out-outline',
      danger: true,
      onPress: handleLogout,
    },
  ];

  const name = user?.fullName?.trim() || '';
  const email = user?.email?.trim() || '';
  const avatarUrl = user?.avatar?.trim() || null;
  const showLoader = authLoading && !user;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Profile</Text>

        <View style={styles.hero}>
          {showLoader ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <>
              <Pressable
                onPress={handleAvatarPress}
                disabled={isUploadingAvatar}
                style={({ pressed }) => [
                  styles.avatarPressable,
                  pressed && styles.avatarPressed,
                ]}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>
                      {name ? initials(name) : '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  {isUploadingAvatar ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="camera" size={14} color={Colors.white} />
                  )}
                </View>
              </Pressable>
              <Text style={styles.photoHint}>Tap to add profile photo</Text>
              <Text style={styles.name}>{name || 'No name on file'}</Text>
              <Text style={styles.email}>{email || 'No email on file'}</Text>
            </>
          )}
        </View>

        <View style={styles.list}>
          {settings.map((item, index) => {
            const isLast = index === settings.length - 1;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  if (item.onPress) {
                    item.onPress();
                    return;
                  }
                  if (item.href) {
                    router.push(item.href);
                  }
                }}
                style={({ pressed }) => [
                  styles.row,
                  !isLast && styles.rowBorder,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    item.danger && styles.iconWrapDanger,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.danger ? Colors.danger : Colors.primary}
                  />
                </View>
                <Text
                  style={[styles.rowLabel, item.danger && styles.rowLabelDanger]}
                >
                  {item.label}
                </Text>
                {item.danger ? null : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textSecondary}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.mint,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 6,
    minHeight: 180,
    justifyContent: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  avatarPressable: {
    marginBottom: 4,
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  photoHint: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  list: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: {
    backgroundColor: Colors.interactionSevereBg,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  rowLabelDanger: {
    color: Colors.danger,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: Colors.inputBackground,
  },
});
