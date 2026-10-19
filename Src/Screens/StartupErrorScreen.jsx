import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  NativeModules,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FocusFlowIcon from '../Components/FocusFlowIcon';

const { SplashModule } = NativeModules;

export default function StartupErrorScreen({ error, onRetry }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Ensure native splash is dismissed so error screen is clearly visible
    if (SplashModule?.hide) {
      SplashModule.hide().catch(() => {});
    }
  }, []);

  const errorMessage =
    error && typeof error === 'object'
      ? error.message || 'An unexpected error occurred during startup.'
      : typeof error === 'string'
      ? error
      : 'An unexpected error occurred during startup.';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FF" />

      <View style={styles.content}>
        <FocusFlowIcon size={84} />

        <Text style={styles.title}>Unable to Initialize FocusFlow</Text>

        <Text style={styles.description}>
          FocusFlow encountered an issue while loading local storage and configuration.
        </Text>

        <View style={styles.errorBox}>
          <Text style={styles.errorText} numberOfLines={4}>
            {errorMessage}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry startup initialization"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF',
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#20283A',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#727A91',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    lineHeight: 18,
  },
  retryButton: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
