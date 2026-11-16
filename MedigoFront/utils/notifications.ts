import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureAndroidChannel(id = 'medicine-reminders', name = 'Medicine Reminders'): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
  });
}

function parseTime(time24: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = time24.split(':');
  return {
    hour: Number(hourStr),
    minute: Number(minuteStr),
  };
}

export async function cancelMedicineReminders(medicineId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.medicineId === medicineId)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function scheduleMedicineReminders(options: {
  medicineId: string;
  medicineName: string;
  dosage: string;
  reminderTimes: string[];
}): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return;
  }

  await ensureAndroidChannel();
  await cancelMedicineReminders(options.medicineId);

  await Promise.all(
    options.reminderTimes.map(async (time) => {
      const { hour, minute } = parseTime(time);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medicine Reminder',
          body: `Time to take ${options.medicineName} (${options.dosage})`,
          data: {
            medicineId: options.medicineId,
            url: `/medicines/${options.medicineId}`,
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'medicine-reminders',
        },
      });
    }),
  );
}

export async function snoozeReminderNotification(options: {
  medicineId: string;
  medicineName: string;
  dosage: string;
  minutes?: number;
}): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return;
  }

  await ensureAndroidChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Snoozed Reminder',
      body: `Time to take ${options.medicineName} (${options.dosage})`,
      data: {
        medicineId: options.medicineId,
        url: '/reminders',
      },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: (options.minutes ?? 10) * 60,
      channelId: 'medicine-reminders',
    },
  });
}

export async function cancelAppointmentReminder(appointmentId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.appointmentId === appointmentId)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function scheduleAppointmentReminder(options: {
  appointmentId: string;
  doctorName: string;
  clinic: string;
  startsAt: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return;
  }

  await ensureAndroidChannel('appointment-reminders', 'Appointment Reminders');
  await cancelAppointmentReminder(options.appointmentId);

  const startDate = new Date(options.startsAt);
  const reminderDate = new Date(startDate.getTime() - 60 * 60 * 1000);

  if (reminderDate.getTime() <= Date.now()) {
    // If appointment is within an hour, notify a few minutes before when possible.
    const fallback = new Date(startDate.getTime() - 10 * 60 * 1000);
    if (fallback.getTime() <= Date.now()) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upcoming Appointment',
        body: `${options.doctorName} at ${options.clinic} starts soon`,
        data: {
          appointmentId: options.appointmentId,
          url: '/(tabs)/appointments',
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fallback,
        channelId: 'appointment-reminders',
      },
    });
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Appointment Reminder',
      body: `You have an appointment with ${options.doctorName} at ${options.clinic} in 1 hour`,
      data: {
        appointmentId: options.appointmentId,
        url: '/(tabs)/appointments',
      },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: 'appointment-reminders',
    },
  });
}

export async function notifyEmergencyAlertSent(options: {
  contactCount: number;
  mapsLink: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return;
  }

  await ensureAndroidChannel('emergency-sos', 'Emergency SOS');

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Emergency alert sent',
      body: `Location shared with ${options.contactCount} contact${options.contactCount === 1 ? '' : 's'}.`,
      data: {
        url: '/sos',
        mapsLink: options.mapsLink,
      },
      sound: true,
    },
    trigger: null,
  });
}
