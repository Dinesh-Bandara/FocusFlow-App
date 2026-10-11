import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../Theme/Theme';
import CustomButton from './CustomButton';

export default function CalendarEventCard({ event, onStartFocus, onReminderPress }) {
  const [localMode, setLocalMode] = React.useState(event.reminder_mode || 0);

  React.useEffect(() => {
    setLocalMode(event.reminder_mode || 0);
  }, [event.reminder_mode]);

  // Parse event times (Google Calendar standard format)
  const startTime = event.start?.dateTime ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day';
  const endTime = event.end?.dateTime ? new Date(event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const timeDisplay = endTime ? `${startTime} - ${endTime}` : startTime;

  const handlePress = (targetMode, offset) => {
    setLocalMode(targetMode);
    if (onReminderPress) {
      onReminderPress(targetMode, offset);
    }
  };

  return (
    <View style={styles.eventCard}>
      <Text style={styles.eventTitle}>{event.summary || "Busy"}</Text>
      <Text style={styles.eventTime}>{timeDisplay}</Text>

      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Reminder:</Text>
        <CustomButton title="Off" onPress={() => handlePress(0, 0)} variant={localMode === 0 ? "primary" : "secondary"} style={styles.smBtn} />
        <CustomButton title="Notif" onPress={() => handlePress(1, 5)} variant={localMode === 1 ? "primary" : "secondary"} style={styles.smBtn} />
        <CustomButton title="Alarm" onPress={() => handlePress(2, 5)} variant={localMode === 2 ? "primary" : "secondary"} style={styles.smBtn} />
      </View>

      <View style={styles.actionRow}>
        <CustomButton title="Start Focus" onPress={onStartFocus} variant="primary" style={styles.focusBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: Theme.spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsLabel: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
  },
  smBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  focusBtn: {
    paddingVertical: 10,
    width: '100%',
  }
});
