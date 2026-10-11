import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../Theme/Theme';

export default function AppUsageItem({ appName, durationMs }) {
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);

  const displayTime = hours > 0 ? (hours + "h " + minutes + "m") : (minutes + "m");

  return (
    <View style={styles.container}>
      <View style={styles.iconPlaceholder}>
        <Text style={styles.iconCharacter}>{appName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{appName}</Text>
        {/* Placeholder for future usage bar */}
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: Math.min(100, Math.max(5, (durationMs / 10800000) * 100)) + '%' }]} />
        </View>
      </View>
      <Text style={styles.time}>{displayTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  iconCharacter: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  info: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  name: {
    fontSize: 16,
    color: Theme.colors.text,
    marginBottom: 4,
  },
  barBackground: {
    height: 6,
    backgroundColor: Theme.colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
  },
  time: {
    fontSize: 16,
    fontWeight: '500',
    color: Theme.colors.textSecondary,
  },
});
