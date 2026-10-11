import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Theme } from '../Theme/Theme';
import CustomButton from '../Components/CustomButton';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const navigation = useNavigation();

  const handleExportData = () => {
    Alert.alert("Export", "This feature will export your local SQLite database records into a CSV/JSON mapping in the future.");
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset Data",
      "Are you sure you want to delete all historical app usage stats, unlock counts, and focus sessions?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => console.log('Deleted data.') }
      ]
    );
  };

  const handlePermissions = () => {
    navigation.navigate("Permissions");
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        <CustomButton title="Manage Permissions" onPress={handlePermissions} variant="secondary" style={styles.btn} />
        <CustomButton title="Set Daily App Usage Targets" onPress={() => { }} variant="secondary" style={styles.btn} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local Data</Text>
        <Text style={styles.description}>
          FocusFlow uses SQLite to keep all your tracking records exclusively on this device.
        </Text>
        <CustomButton title="Export Tracking Records" onPress={handleExportData} variant="secondary" style={styles.btn} />
        <CustomButton title="Delete All Tracking Data" onPress={handleResetData} variant="secondary" style={styles.btnDanger} />
      </View>

      <View style={styles.section}>
        <Text style={styles.versionInfo}>FocusFlow v1.0.0 (Beta)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Theme.colors.text,
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    marginBottom: Theme.spacing.md,
  },
  section: {
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    marginBottom: Theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  description: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.md,
  },
  btn: {
    marginBottom: Theme.spacing.sm,
  },
  btnDanger: {
    marginBottom: Theme.spacing.sm,
    borderColor: Theme.colors.error,
  },
  versionInfo: {
    textAlign: 'center',
    color: Theme.colors.textSecondary,
    fontSize: 12,
  }
});
