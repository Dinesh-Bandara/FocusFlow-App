import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../Theme/Theme';

export default function StatCard({ title, value, subtitle, icon }) {
  return (
    <View style={styles.card}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginVertical: Theme.spacing.xs,
    marginHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  iconContainer: {
    marginRight: Theme.spacing.md,
    padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.borderRadius.round,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  }
});
