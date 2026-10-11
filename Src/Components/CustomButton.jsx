import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Theme } from '../Theme/Theme';

export default function CustomButton({ title, onPress, variant = 'primary', style }) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.button, isPrimary ? styles.primary : styles.secondary, style]}
      onPress={onPress}
    >
      <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Theme.colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: Theme.colors.primary,
  }
});
