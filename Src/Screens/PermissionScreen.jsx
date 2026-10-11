import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeModules } from 'react-native';
import CustomButton from '../Components/CustomButton';
import { Theme } from '../Theme/Theme';
import { useNavigation } from '@react-navigation/native';
import { Routes } from '../Constants/Routes';

const { NativeTracking } = NativeModules;

export default function PermissionScreen() {
  const navigation = useNavigation();

  const handleGrantUsage = () => {
    if (NativeTracking) {
      NativeTracking.openUsageSettings();
    }
  };

  const handleContinue = () => {
    navigation.replace('MainTabs');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permissions Required</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage Access</Text>
        <Text style={styles.cardDesc}>
          FocusFlow needs Usage Access to display your screen-on time and application usage statistics.
        </Text>
        <CustomButton title="Grant Usage Access" onPress={handleGrantUsage} style={styles.button} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notification Access</Text>
        <Text style={styles.cardDesc}>
          To count the distractions caused by notifications correctly, FocusFlow requires Notification Access. We do not store message contents.
        </Text>
        <CustomButton title="Grant Notification Access" onPress={() => console.log('WIP')} style={styles.button} variant="secondary" />
      </View>

      <View style={styles.footer}>
        <CustomButton title="Skip for now" onPress={handleContinue} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  cardDesc: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.md,
    lineHeight: 20,
  },
  button: {
    marginTop: Theme.spacing.sm,
  },
  footer: {
    marginTop: Theme.spacing.xl,
  }
});
