import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModules } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import { Theme } from '../Theme/Theme';
import { Routes } from '../Constants/Routes';
import { TargetStorageService } from '../Services/TargetStorageService';

const { NativeTracking } = NativeModules;

export default function UsageScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;

  const navigation = useNavigation();
  const [usageStats, setUsageStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Today'); // 'Today' | '7 Days'
  const [sortBy, setSortBy] = useState('By time'); // 'By time' | 'A-Z'
  const [dailyTargetMin, setDailyTargetMin] = useState(240); // 4 hours in minutes
  const [hourlyRaw, setHourlyRaw] = useState(new Array(24).fill(0));
  const [unlocksCount, setUnlocksCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  // Compute timestamp ranges based on selectedFilter
  const dateRange = useMemo(() => {
    const now = new Date();
    if (selectedFilter === 'Today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = startOfDay + 86400000;
      return { startMs: startOfDay, endMs: endOfDay };
    } else {
      const startOf7Days = Date.now() - 7 * 86400000;
      return { startMs: startOf7Days, endMs: Date.now() };
    }
  }, [selectedFilter]);

  const loadData = useCallback(async () => {
    try {
      // 1. Load target from storage
      const savedTarget = await TargetStorageService.getUsageTarget();
      setDailyTargetMin(savedTarget || 240);

      if (NativeTracking) {
        const access = await NativeTracking.hasUsageAccess();
        setHasPermission(access);

        if (access) {
          // 2. Load usage stats for date range
          if (NativeTracking.getUsageRange) {
            const stats = await NativeTracking.getUsageRange(dateRange.startMs, dateRange.endMs);
            setUsageStats(stats || {});
          } else {
            const stats = await NativeTracking.getDailyForegroundUsage();
            setUsageStats(stats || {});
          }

          // 3. Load unlocks for date range
          if (NativeTracking.getUnlockCountRange) {
            const count = await NativeTracking.getUnlockCountRange(dateRange.startMs, dateRange.endMs);
            setUnlocksCount(count || 0);
          }

          // 4. Load hourly stats for Today
          if (NativeTracking.getHourlyUsageToday) {
            const hourly = await NativeTracking.getHourlyUsageToday();
            if (Array.isArray(hourly)) {
              setHourlyRaw(hourly);
            }
          }
        } else {
          setUsageStats({});
          setUnlocksCount(0);
        }
      }
    } catch (e) {
      console.warn('Failed to load usage data:', e);
    }
  }, [dateRange]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setLoading(true);
    await loadData();
    setLoading(false);
  };

  // Calculate actual total usage
  const { totalHours, totalMinutes, totalMs, appList } = useMemo(() => {
    const entries = Object.entries(usageStats || {}).map(([pkg, ms]) => ({
      packageName: pkg,
      durationMs: Number(ms),
    }));

    const total = entries.reduce((acc, curr) => acc + curr.durationMs, 0);
    const hrs = Math.floor(total / 3600000);
    const mins = Math.floor((total % 3600000) / 60000);

    const filtered = entries
      .filter((app) => app.durationMs > 20000) // apps with > 20s
      .sort((a, b) => {
        if (sortBy === 'A-Z') {
          return a.packageName.localeCompare(b.packageName);
        }
        return b.durationMs - a.durationMs;
      });

    return {
      totalHours: hrs,
      totalMinutes: mins,
      totalMs: total,
      appList: filtered,
    };
  }, [usageStats, sortBy]);

  // Target progress percentage
  const effectiveTargetMs = selectedFilter === '7 Days' ? dailyTargetMin * 7 * 60000 : dailyTargetMin * 60000;
  const targetProgress = effectiveTargetMs > 0
    ? Math.min(100, Math.round((totalMs / effectiveTargetMs) * 100))
    : 0;

  const isOverTarget = totalMs > effectiveTargetMs;

  // Hourly chart data: sample buckets (06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
  const hourlyData = useMemo(() => {
    const buckets = [
      { label: '06', hour: 6 },
      { label: '09', hour: 9 },
      { label: '12', hour: 12 },
      { label: '15', hour: 15 },
      { label: '18', hour: 18 },
      { label: '21', hour: 21 },
    ];

    // Find max value in raw hourly
    let maxVal = Math.max(...hourlyRaw, 1);

    return buckets.map((b) => {
      // Sum the 3-hour window around this mark
      const sum = (hourlyRaw[b.hour] || 0) + (hourlyRaw[b.hour + 1] || 0) + (hourlyRaw[b.hour + 2] || 0);
      const heightPercent = Math.min(100, Math.max(8, Math.round((sum / (maxVal * 2.5)) * 100)));
      return {
        label: b.label,
        height: heightPercent,
      };
    });
  }, [hourlyRaw]);

  const handleEditTarget = () => {
    Alert.alert(
      'Daily Usage Target',
      'Select your desired maximum daily screen time target:',
      [
        {
          text: '2 Hours (120m)',
          onPress: async () => {
            setDailyTargetMin(120);
            await TargetStorageService.setUsageTarget(120);
          },
        },
        {
          text: '3 Hours (180m)',
          onPress: async () => {
            setDailyTargetMin(180);
            await TargetStorageService.setUsageTarget(180);
          },
        },
        {
          text: '4 Hours (240m)',
          onPress: async () => {
            setDailyTargetMin(240);
            await TargetStorageService.setUsageTarget(240);
          },
        },
        {
          text: '5 Hours (300m)',
          onPress: async () => {
            setDailyTargetMin(300);
            await TargetStorageService.setUsageTarget(300);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'By time' ? 'A-Z' : 'By time'));
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Theme.colors.primary]} />}
      >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.titleText}>App Usage</Text>
          <Text style={styles.subtitleText}>Understand your screen time</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate(Routes.SETTINGS)}
          style={styles.settingsButton}
          accessibilityLabel="Settings"
          activeOpacity={0.7}
        >
          {/* Settings Gear */}
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
              stroke="#20283A"
              strokeWidth={2}
            />
            <Path
              d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.8 16.9A2 2 0 1 1 17 19.72L16.92 19.64A1.65 1.65 0 0 0 15.1 19.31A1.65 1.65 0 0 0 14 20.86V21A2 2 0 1 1 10 21V20.84A1.65 1.65 0 0 0 8.9 19.31A1.65 1.65 0 0 0 7.08 19.64L7 19.72A2 2 0 1 1 4.18 16.9L4.26 16.82A1.65 1.65 0 0 0 4.6 15A1.65 1.65 0 0 0 3.05 13.9H3A2 2 0 1 1 3 9.9H3.14A1.65 1.65 0 0 0 4.67 8.8A1.65 1.65 0 0 0 4.34 7L4.26 6.9A2 2 0 1 1 7.08 4.08L7.16 4.16A1.65 1.65 0 0 0 9 4.49A1.65 1.65 0 0 0 10.1 2.94V2.8A2 2 0 1 1 14.1 2.8V2.95A1.65 1.65 0 0 0 15.2 4.48A1.65 1.65 0 0 0 17 4.15L17.1 4.07A2 2 0 1 1 19.92 6.9L19.84 6.98A1.65 1.65 0 0 0 19.5 8.8A1.65 1.65 0 0 0 21.05 9.9H21.2A2 2 0 1 1 21.2 13.9H21.05A1.65 1.65 0 0 0 19.4 15Z"
              stroke="#20283A"
              strokeWidth={2}
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter (Today / 7 Days) */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          onPress={() => setSelectedFilter('Today')}
          style={[styles.segmentBtn, selectedFilter === 'Today' && styles.segmentBtnActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, selectedFilter === 'Today' && styles.segmentTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedFilter('7 Days')}
          style={[styles.segmentBtn, selectedFilter === '7 Days' && styles.segmentBtnActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, selectedFilter === '7 Days' && styles.segmentTextActive]}>7 Days</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Time Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Screen time</Text>
        <Text style={styles.heroTimeValue}>{totalHours}h {totalMinutes}m</Text>

        <View style={styles.diffRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d={isOverTarget ? 'M12 19V5M12 5L5 12M12 5L19 12' : 'M12 5V19M12 19L5 12M12 19L19 12'}
              stroke={isOverTarget ? '#E05252' : '#10B981'}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={[styles.diffText, isOverTarget && { color: '#E05252' }]}>
            {isOverTarget ? 'Over daily target' : 'Within daily target'}
          </Text>
        </View>

        {/* Hourly Bar Chart */}
        <View style={styles.chartContainer}>
          <View style={styles.chartBarsRow}>
            {hourlyData.map((item) => (
              <View key={item.label} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${item.height}%` }]} />
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Side-by-side Statistic Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Rect x={5} y={2} width={14} height={20} rx={3} stroke="#5056D8" strokeWidth={2} />
              <Line x1={11} y1={18} x2={13} y2={18} stroke="#5056D8" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.statValue}>{unlocksCount}</Text>
          <Text style={styles.statLabel}>Unlocks</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconBadge}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#5056D8" strokeWidth={2} />
              <Path d="M13.73 21A2 2 0 0 1 10.27 21" stroke="#5056D8" strokeWidth={2} />
            </Svg>
          </View>
          <Text style={styles.statValue}>{notificationsCount}</Text>
          <Text style={styles.statLabel}>Notifications</Text>
        </View>
      </View>

      {/* Most Used Apps Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Most used apps</Text>
        <TouchableOpacity style={styles.sortDropdown} onPress={toggleSort} activeOpacity={0.7}>
          <Text style={styles.sortText}>{sortBy} ▾</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.appsListCard}>
        {appList.length > 0 ? (
          appList.map((app, index) => {
            const minutesUsed = Math.max(1, Math.round(app.durationMs / 60000));
            const progress = Math.min(100, Math.round((minutesUsed / 60) * 100));
            const displayName = app.packageName.split('.').pop() || app.packageName;

            return (
              <View key={app.packageName} style={[styles.appItemRow, index < appList.length - 1 && styles.appItemBorder]}>
                <View style={styles.appIconBadge}>
                  <Text style={styles.appIconLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.appItemContent}>
                  <View style={styles.appItemTop}>
                    <Text style={styles.appItemName}>{displayName}</Text>
                    <Text style={styles.appItemDuration}>{minutesUsed}m</Text>
                  </View>
                  <View style={styles.appItemProgressTrack}>
                    <View style={[styles.appItemProgressFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {hasPermission
                ? `No app usage recorded for ${selectedFilter.toLowerCase()}.`
                : 'Grant usage stats permission to view app breakdown.'}
            </Text>
          </View>
        )}
      </View>

      {/* Daily Usage Target Card */}
      <View style={styles.targetCard}>
        <View style={styles.targetIconWrap}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={9} stroke="#5056D8" strokeWidth={2} />
            <Circle cx={12} cy={12} r={4} stroke="#5056D8" strokeWidth={2} />
          </Svg>
        </View>
        <View style={styles.targetInfoCol}>
          <View style={styles.targetTopRow}>
            <View>
              <Text style={styles.targetTitle}>
                {selectedFilter === 'Today' ? 'Daily usage target' : '7-Day usage target'}
              </Text>
              <Text style={styles.targetAmount}>
                {totalHours}h {totalMinutes}m of {Math.floor(effectiveTargetMs / 3600000)}h
              </Text>
            </View>
            <TouchableOpacity onPress={handleEditTarget} activeOpacity={0.7}>
              <Text style={styles.editTargetLink}>Edit target</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.targetProgressTrack}>
            <View
              style={[
                styles.targetProgressFill,
                { width: `${targetProgress}%` },
                isOverTarget && { backgroundColor: '#E05252' },
              ]}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  </>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#20283A',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    color: '#727A91',
    marginTop: 2,
    fontWeight: '500',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8ECF8',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#5056D8',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#727A91',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    ...Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: '#1A2035', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#727A91',
  },
  heroTimeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#20283A',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 16,
  },
  diffText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  chartContainer: {
    height: 100,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  chartBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 22,
    height: 60,
    backgroundColor: '#F0F2FA',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#5056D8',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    alignItems: 'center',
  },
  statIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#20283A',
  },
  statLabel: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#20283A',
  },
  sortDropdown: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#727A91',
  },
  appsListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    marginBottom: 20,
  },
  appItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  appItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2FA',
  },
  appIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  appIconLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5056D8',
  },
  appItemContent: {
    flex: 1,
  },
  appItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  appItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
  },
  appItemDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#727A91',
  },
  appItemProgressTrack: {
    height: 6,
    backgroundColor: '#F0F2FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  appItemProgressFill: {
    height: '100%',
    backgroundColor: '#5056D8',
    borderRadius: 3,
  },
  targetCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    alignItems: 'center',
  },
  targetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  targetInfoCol: {
    flex: 1,
  },
  targetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  targetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#20283A',
  },
  targetAmount: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 1,
  },
  editTargetLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5056D8',
  },
  targetProgressTrack: {
    height: 6,
    backgroundColor: '#F0F2FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  targetProgressFill: {
    height: '100%',
    backgroundColor: '#5056D8',
    borderRadius: 3,
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#727A91',
    textAlign: 'center',
  },
});
