import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { NativeModules } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import CustomButton from '../Components/CustomButton';
import { Theme } from '../Theme/Theme';

const { NativeTracking } = NativeModules;

export default function PermissionScreen() {
  const navigation = useNavigation();
  const [hasUsageAccess, setHasUsageAccess] = useState(false);
  const [hasNotificationAccess, setHasNotificationAccess] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (NativeTracking) {
      try {
        const usage = await NativeTracking.hasUsageAccess();
        setHasUsageAccess(!!usage);
      } catch (e) {
        console.warn('Error checking usage access:', e);
      }

      try {
        if (NativeTracking.hasNotificationAccess) {
          const notif = await NativeTracking.hasNotificationAccess();
          setHasNotificationAccess(!!notif);
        }
      } catch (e) {
        console.warn('Error checking notification access:', e);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkPermissions();
    }, [checkPermissions])
  );

  const handleGrantUsage = () => {
    if (NativeTracking?.openUsageSettings) {
      NativeTracking.openUsageSettings();
    }
  };

  const handleGrantNotification = () => {
    if (NativeTracking?.openNotificationSettings) {
      NativeTracking.openNotificationSettings();
    }
  };

  const handleContinue = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <Text style={styles.title}>Permissions & Tracking</Text>
      <Text style={styles.subtitle}>
        FocusFlow runs completely offline on your device. We measure digital habits without collecting personal messages or content.
      </Text>

      {/* Usage Access Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Usage Access</Text>
          <View style={[styles.badge, hasUsageAccess ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={[styles.badgeText, hasUsageAccess ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
              {hasUsageAccess ? '✓ Granted' : 'Required'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>
          Required to display exact screen-on time, app transitions, and unlock events within your selected time range.
        </Text>
        <CustomButton
          title={hasUsageAccess ? 'Usage Access Granted' : 'Grant Usage Access'}
          onPress={handleGrantUsage}
          variant={hasUsageAccess ? 'secondary' : 'primary'}
          style={styles.button}
        />
      </View>

      {/* Notification Access Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Notification Access</Text>
          <View style={[styles.badge, hasNotificationAccess ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={[styles.badgeText, hasNotificationAccess ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
              {hasNotificationAccess ? '✓ Granted' : 'Required'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>
          Count distraction interruptions from incoming notifications. Message content, sender names, and sensitive details are never read or stored.
        </Text>
        <CustomButton
          title={hasNotificationAccess ? 'Notification Access Granted' : 'Grant Notification Access'}
          onPress={handleGrantNotification}
          variant={hasNotificationAccess ? 'secondary' : 'primary'}
          style={styles.button}
        />
      </View>

      <View style={styles.footer}>
        <CustomButton title="Done" onPress={handleContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 24 : 40,
    backgroundColor: '#F7F8FF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#727A91',
    lineHeight: 18,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#20283A',
  },
  cardDesc: {
    fontSize: 13,
    color: '#727A91',
    marginBottom: 14,
    lineHeight: 19,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: '#DEF7EC',
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextSuccess: {
    color: '#03543F',
  },
  badgeTextWarning: {
    color: '#92400E',
  },
  button: {
    marginTop: 4,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 30,
  },
});
