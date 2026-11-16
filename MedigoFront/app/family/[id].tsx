import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppointmentCard } from '@/components/AppointmentCard';
import { HealthMetricCard } from '@/components/HealthMetricCard';
import { MedicineCard } from '@/components/MedicineCard';
import { Colors } from '@/constants/colors';
import { appointmentService } from '@/services/appointmentService';
import { familyService } from '@/services/familyService';
import { healthService } from '@/services/healthService';
import { medicineService } from '@/services/medicineService';
import type { Appointment } from '@/types/appointment';
import type { FamilyMember } from '@/types/family';
import type { HealthMetricRecord } from '@/types/health';
import type { Medicine } from '@/types/medicine';

type DetailTab = 'medicines' | 'health' | 'appointments';

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'medicines', label: 'Medicines' },
  { key: 'health', label: 'Health Records' },
  { key: 'appointments', label: 'Appointments' },
];

export default function FamilyMemberDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [member, setMember] = useState<FamilyMember | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('medicines');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthMetricRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemberData = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const data = await familyService.getById(id);
      setMember(data);

      setIsTabLoading(true);
      const [meds, health, appts] = await Promise.all([
        medicineService.getAll({ familyMemberId: data.id }),
        healthService.getAll({ familyMemberId: data.id }),
        appointmentService.getAll({ familyMemberId: data.id }),
      ]);
      setMedicines(meds);
      setHealthRecords(health);
      setAppointments(appts);
    } catch {
      setMember(null);
      setError('Unable to load this family member.');
    } finally {
      setIsLoading(false);
      setIsTabLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadMemberData();
    }, [loadMemberData]),
  );

  const openAddMedicine = () => {
    if (!member) {
      return;
    }
    router.push(
      `/medicines/add?familyMemberId=${encodeURIComponent(member.id)}&familyMemberName=${encodeURIComponent(member.name)}` as Href,
    );
  };

  if (isLoading && !member) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missing}>{error ?? 'Family member not found'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const medicineCount = medicines.filter((item) => item.status !== 'inactive').length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Member Detail</Text>
        <Pressable
          onPress={() => router.push(`/family/add?id=${member.id}` as Href)}
          hitSlop={12}
          style={styles.iconButton}
        >
          <Ionicons name="create-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          {member.avatarUrl ? (
            <Image source={{ uri: member.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={36} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.relation}>
            {member.relation}
            {member.age != null ? ` · ${member.age} yrs` : ''}
            {member.bloodGroup ? ` · ${member.bloodGroup}` : ''}
          </Text>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {medicineCount} active medicine{medicineCount === 1 ? '' : 's'}
            </Text>
          </View>

          {member.allergies.length > 0 ? (
            <View style={styles.tagsBlock}>
              <Text style={styles.tagsLabel}>Allergies</Text>
              <View style={styles.tags}>
                {member.allergies.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {member.chronicConditions.length > 0 ? (
            <View style={styles.tagsBlock}>
              <Text style={styles.tagsLabel}>Chronic Conditions</Text>
              <View style={styles.tags}>
                {member.chronicConditions.map((tag) => (
                  <View key={tag} style={[styles.tag, styles.conditionTag]}>
                    <Text style={[styles.tagText, styles.conditionTagText]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.tabsWrap}>
          <View style={styles.tabs}>
            {TABS.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tab, selected && styles.tabSelected]}
                >
                  <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.tabContent}>
          {isTabLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.tabLoader} />
          ) : null}

          {activeTab === 'medicines' ? (
            medicines.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>
                  No medicines for {member.name} yet.
                </Text>
                <Pressable
                  onPress={openAddMedicine}
                  style={({ pressed }) => [
                    styles.emptyAddButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="add" size={18} color={Colors.white} />
                  <Text style={styles.emptyAddText}>Add medicine</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.listGap}>
                {medicines.map((item) => (
                  <MedicineCard
                    key={item.id}
                    medicine={item}
                    memberLabel={member.name}
                    onPress={() =>
                      router.push(
                        `/medicines/${item.id}?familyMemberId=${member.id}&familyMemberName=${encodeURIComponent(member.name)}` as Href,
                      )
                    }
                  />
                ))}
              </View>
            )
          ) : null}

          {activeTab === 'health' ? (
            healthRecords.length === 0 ? (
              <Text style={styles.emptyText}>No health records for this member.</Text>
            ) : (
              <View style={styles.listGap}>
                {healthRecords.map((item) => (
                  <HealthMetricCard key={item.id} record={item} />
                ))}
              </View>
            )
          ) : null}

          {activeTab === 'appointments' ? (
            appointments.length === 0 ? (
              <Text style={styles.emptyText}>No appointments for this member.</Text>
            ) : (
              <View style={styles.listGap}>
                {appointments.map((item) => (
                  <AppointmentCard key={item.id} appointment={item} />
                ))}
              </View>
            )
          ) : null}
        </View>
      </ScrollView>

      {activeTab === 'medicines' ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={openAddMedicine}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={22} color={Colors.white} />
            <Text style={styles.addButtonText}>Add Medicine for {member.name}</Text>
          </Pressable>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  missing: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  backLink: {
    color: Colors.primary,
    fontWeight: '700',
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
    paddingBottom: 24,
  },
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.mint,
    marginBottom: 6,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  relation: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  badge: {
    marginTop: 8,
    backgroundColor: Colors.mint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  tagsBlock: {
    width: '100%',
    marginTop: 10,
    gap: 6,
  },
  tagsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  conditionTag: {
    backgroundColor: Colors.peach,
  },
  conditionTagText: {
    color: Colors.warning,
  },
  tabsWrap: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: Colors.chipInactive,
  },
  tabSelected: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tabTextSelected: {
    color: Colors.white,
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  tabLoader: {
    marginVertical: 16,
  },
  listGap: {
    gap: 10,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 8,
    fontSize: 14,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyAddText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
