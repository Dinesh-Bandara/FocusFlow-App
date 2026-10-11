const fs = require('fs');

const generateComponent = (name) => `import React from 'react';\nimport { View, Text, StyleSheet } from 'react-native';\n\nexport default function ${name}() {\n  return (\n    <View style={styles.container}>\n      <Text>${name}</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }\n});\n`;

const files = {
  // Screens
  'Src/Screens/OnboardingScreen.jsx': generateComponent('OnboardingScreen'),
  'Src/Screens/PermissionScreen.jsx': generateComponent('PermissionScreen'),
  'Src/Screens/DashboardScreen.jsx': generateComponent('DashboardScreen'),
  'Src/Screens/UsageScreen.jsx': generateComponent('UsageScreen'),
  'Src/Screens/AppUsageDetailScreen.jsx': generateComponent('AppUsageDetailScreen'),
  'Src/Screens/AppLimitScreen.jsx': generateComponent('AppLimitScreen'),
  'Src/Screens/ScheduleScreen.jsx': generateComponent('ScheduleScreen'),
  'Src/Screens/CalendarSelectionScreen.jsx': generateComponent('CalendarSelectionScreen'),
  'Src/Screens/EventDetailScreen.jsx': generateComponent('EventDetailScreen'),
  'Src/Screens/FocusScreen.jsx': generateComponent('FocusScreen'),
  'Src/Screens/FocusSummaryScreen.jsx': generateComponent('FocusSummaryScreen'),
  'Src/Screens/ReportScreen.jsx': generateComponent('ReportScreen'),
  'Src/Screens/SettingsScreen.jsx': generateComponent('SettingsScreen'),
  'Src/Screens/BackupRestoreScreen.jsx': generateComponent('BackupRestoreScreen'),

  // Components
  'Src/Components/CustomButton.jsx': generateComponent('CustomButton'),
  'Src/Components/CustomInput.jsx': generateComponent('CustomInput'),
  'Src/Components/ScreenContainer.jsx': generateComponent('ScreenContainer'),
  'Src/Components/Header.jsx': generateComponent('Header'),
  'Src/Components/StatCard.jsx': generateComponent('StatCard'),
  'Src/Components/AppUsageItem.jsx': generateComponent('AppUsageItem'),
  'Src/Components/UsageChart.jsx': generateComponent('UsageChart'),
  'Src/Components/CalendarEventCard.jsx': generateComponent('CalendarEventCard'),
  'Src/Components/FocusTimer.jsx': generateComponent('FocusTimer'),
  'Src/Components/PermissionCard.jsx': generateComponent('PermissionCard'),
  'Src/Components/LoadingView.jsx': generateComponent('LoadingView'),
  'Src/Components/EmptyState.jsx': generateComponent('EmptyState'),
  'Src/Components/ErrorState.jsx': generateComponent('ErrorState'),

  // Navigation
  'Src/Navigation/AppNavigator.jsx': generateComponent('AppNavigator'),
  'Src/Navigation/OnboardingNavigator.jsx': generateComponent('OnboardingNavigator'),
  'Src/Navigation/BottomTabNavigator.jsx': generateComponent('BottomTabNavigator'),

  // Context
  'Src/Context/SettingsContext.jsx': generateComponent('SettingsContext'),
  'Src/Context/ThemeContext.jsx': generateComponent('ThemeContext'),

  // Hooks
  'Src/Hooks/useDashboard.js': `export const useDashboard = () => {};\n`,
  'Src/Hooks/useUsage.js': `export const useUsage = () => {};\n`,
  'Src/Hooks/usePermissions.js': `export const usePermissions = () => {};\n`,
  'Src/Hooks/useCalendar.js': `export const useCalendar = () => {};\n`,
  'Src/Hooks/useFocusSession.js': `export const useFocusSession = () => {};\n`,
  'Src/Hooks/useWeeklyReport.js': `export const useWeeklyReport = () => {};\n`,

  // Services
  'Src/Services/Native/TrackingService.js': `export const TrackingService = {};\n`,
  'Src/Services/Native/StorageService.js': `export const StorageService = {};\n`,
  'Src/Services/Native/ReminderService.js': `export const ReminderService = {};\n`,
  'Src/Services/Native/PermissionService.js': `export const PermissionService = {};\n`,
  'Src/Services/Native/FocusService.js': `export const FocusService = {};\n`,
  'Src/Services/Native/BackupService.js': `export const BackupService = {};\n`,

  'Src/Services/Google/GoogleAuthService.js': `export const GoogleAuthService = {};\n`,
  'Src/Services/Google/CalendarApiService.js': `export const CalendarApiService = {};\n`,
  'Src/Services/Google/CalendarSyncService.js': `export const CalendarSyncService = {};\n`,

  // NativeSpecs
  'Src/NativeSpecs/NativeTracking.js': `export default {};\n`,
  'Src/NativeSpecs/NativeStorage.js': `export default {};\n`,
  'Src/NativeSpecs/NativeReminders.js': `export default {};\n`,
  'Src/NativeSpecs/NativePermissions.js': `export default {};\n`,
  'Src/NativeSpecs/NativeFocus.js': `export default {};\n`,
  'Src/NativeSpecs/NativeBackup.js': `export default {};\n`,

  // Theme
  'Src/Theme/Colors.js': `export const Colors = { primary: '#1E90FF', background: '#FAFAFA' };\n`,
  'Src/Theme/Typography.js': `export const Typography = {};\n`,
  'Src/Theme/Spacing.js': `export const Spacing = {};\n`,
  'Src/Theme/Theme.js': `import { Colors } from './Colors'; export const Theme = { colors: Colors };\n`,

  // Constants
  'Src/Constants/Routes.js': `export const Routes = {\n  HOME: 'Home',\n  USAGE: 'Usage',\n  SCHEDULE: 'Schedule',\n  FOCUS: 'Focus',\n  REPORTS: 'Reports',\n  SETTINGS: 'Settings'\n};\n`,
  'Src/Constants/FocusPresets.js': `export const FocusPresets = [25, 45, 60];\n`,
  'Src/Constants/Defaults.js': `export const Defaults = {};\n`,

  // Locales
  'Src/Locales/en.json': `{\n  "appName": "FocusFlow"\n}\n`,

  // Utils
  'Src/Utils/DateUtils.js': `export const formatDate = () => {};\n`,
  'Src/Utils/FormatDuration.js': `export const formatDuration = () => {};\n`,
  'Src/Utils/ReportCalculations.js': `export const calculateReport = () => {};\n`,
  'Src/Utils/Validation.js': `export const validate = () => {};\n`,

  // Docs
  'docs/SETUP.md': `# Setup Guide\n`,
  'docs/ARCHITECTURE.md': `# Architecture\n`,
  'docs/DATABASE.md': `# Database Schema\n`,
  'docs/GOOGLE_CALENDAR_SETUP.md': `# Google Calendar Setup\n`,
  'docs/DEVICE_TESTING.md': `# Device Testing Guide\n`,
  'docs/RELEASE.md': `# Release Guide\n`,
};

Object.keys(files).forEach((path) => {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, files[path], 'utf8');
  }
});

console.log('Successfully created all React Native scaffolding files.');
