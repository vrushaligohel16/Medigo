import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { familyService } from '@/services/familyService';
import type { FamilyMember } from '@/types/family';

function medicinesBadgeLabel(count: number): string {
  if (count === 0) {
    return 'No active medicines';
  }
  if (count === 1) {
    return '1 active medicine';
  }
  return `${count} active medicines`;
}

function memberMedicineCount(member: FamilyMember): number {
  return member.medicineCount ?? member.activeMedicinesCount ?? 0;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function FamilyMembersScreen() {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await familyService.getAll();
      setMembers(data);
    } catch {
      setMembers([]);
      setError('Unable to load family members.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers]),
  );

  const renderItem = ({ item }: { item: FamilyMember }) => {
    const count = memberMedicineCount(item);

    return (
      <Pressable
        onPress={() => router.push(`/family/${item.id}` as Href)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials(item.name)}</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.relation}>{item.relation}</Text>
          <View style={styles.badge}>
            <Ionicons name="medical" size={12} color={Colors.primary} />
            <Text style={styles.badgeText}>{medicinesBadgeLabel(count)}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Family</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Family Members</Text>
        <Text style={styles.subtitle}>
          Manage profiles and medicines for everyone you care for
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && members.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={isLoading}
          onRefresh={() => void loadMembers()}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No family members yet. Tap + to add someone.
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        onPress={() => router.push('/family/add' as Href)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 4,
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
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    opacity: 0.92,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.mint,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  relation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    backgroundColor: Colors.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
});
