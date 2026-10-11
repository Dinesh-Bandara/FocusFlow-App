import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModules } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Theme } from '../Theme/Theme';
import { Routes } from '../Constants/Routes';
import { useCalendar } from '../Hooks/useCalendar';
import { useScheduleLifecycle } from '../Hooks/useScheduleLifecycle';
import { FocusStorageService } from '../Services/FocusStorageService';
import { TargetStorageService } from '../Services/TargetStorageService';

const { NativeTracking } = NativeModules;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;

  const navigation = useNavigation();
  const { events, refreshEvents } = useCalendar();
  const { upcomingEvents, ongoingEvents } = useScheduleLifecycle(events);

  const [refreshing, setRefreshing] = useState(false);
  const [usageStats, setUsageStats] = useState({});
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('Today'); // 'Today' | 'Week'

  // Persistent focus goal & live focus sessions metrics
  const [dailyGoalMin, setDailyGoalMin] = useState(240);
  const [focusedMinutes, setFocusedMinutes] = useState(0);
  const [completedSessionsCount, setCompletedSessionsCount] = useState(0);
  const [unlocksCount, setUnlocksCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [sqliteUpcomingEvent, setSqliteUpcomingEvent] = useState(null);

  // Compute timestamp ranges based on selectedPeriod ('Today' vs 'Week')
  const dateRange = useMemo(() => {
    const now = new Date();
    if (selectedPeriod === 'Today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = startOfDay + 86400000;
      return { startMs: startOfDay, endMs: endOfDay, daysCount: 1 };
    } else {
      // Week: Monday of current week to now
      const currentDay = (now.getDay() + 6) % 7; // Monday = 0
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay).getTime();
      const endOfWeek = startOfWeek + 7 * 86400000;
      return { startMs: startOfWeek, endMs: endOfWeek, daysCount: 7 };
    }
  }, [selectedPeriod]);

  const loadAllData = useCallback(async () => {
    try {
      // 1. Goal from persistence
      const goal = await TargetStorageService.getFocusGoal();
      setDailyGoalMin(goal || 240);

      // 2. Focus sessions from SQLite for the selected date range
      const sessions = await FocusStorageService.getFocusSessionsRange(
        dateRange.startMs,
        dateRange.endMs
      );

      let totalDurationMs = 0;
      let completedCount = 0;
      sessions.forEach((s) => {
        totalDurationMs += s.duration_ms || 0;
        if (s.task_completed === 1 || s.status === 'completed') {
          completedCount += 1;
        }
      });
      setFocusedMinutes(Math.round(totalDurationMs / 60000));
      setCompletedSessionsCount(completedCount);

      // 3. Up next event from SQLite
      const nextEvt = await FocusStorageService.getNextUpcomingEvent();
      setSqliteUpcomingEvent(nextEvt);

      // 4. Native tracking usage and unlocks for date range
      if (NativeTracking) {
        const access = await NativeTracking.hasUsageAccess();
        setHasPermission(access);

        if (access) {
          if (NativeTracking.getUsageRange) {
            const stats = await NativeTracking.getUsageRange(dateRange.startMs, dateRange.endMs);
            setUsageStats(stats || {});
          } else {
            const stats = await NativeTracking.getDailyForegroundUsage();
            setUsageStats(stats || {});
          }

          if (NativeTracking.getUnlockCountRange) {
            const unlocks = await NativeTracking.getUnlockCountRange(dateRange.startMs, dateRange.endMs);
            setUnlocksCount(unlocks || 0);
          }
        } else {
          setUsageStats({});
          setUnlocksCount(0);
        }
      }
    } catch (e) {
      console.warn('Failed to load dashboard data:', e);
    }
  }, [dateRange]);

  // Reload when period changes or when screen regains focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAllData(), refreshEvents?.()]);
    setRefreshing(false);
  };

  // Derive today's formatted date string
  const todayDateStr = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  // Effective goal for the selected period
  const effectiveGoalMin = selectedPeriod === 'Week' ? dailyGoalMin * 7 : dailyGoalMin;
  const progressPercent = effectiveGoalMin > 0
    ? Math.min(100, Math.round((focusedMinutes / effectiveGoalMin) * 100))
    : 0;

  // Calculate Screen Time from actual usageStats
  const { hours, minutes, totalMs, topApps } = useMemo(() => {
    const entries = Object.entries(usageStats || {}).map(([pkg, ms]) => ({
      packageName: pkg,
      durationMs: Number(ms),
    }));

    const total = entries.reduce((acc, curr) => acc + curr.durationMs, 0);
    const hrs = Math.floor(total / 3600000);
    const mins = Math.floor((total % 3600000) / 60000);

    const sorted = entries
      .filter((item) => item.durationMs > 30000)
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 3);

    return {
      hours: hrs,
      minutes: mins,
      totalMs: total,
      topApps: sorted,
    };
  }, [usageStats]);

  // Next active session: prioritize ongoing/upcoming from Google Calendar or SQLite
  const nextSession = useMemo(() => {
    if (ongoingEvents && ongoingEvents.length > 0) {
      return {
        title: ongoingEvents[0].summary || 'Focus Session',
        isOngoing: true,
        startMs: new Date(ongoingEvents[0].start?.dateTime || ongoingEvents[0].start?.date || Date.now()).getTime(),
        endMs: new Date(ongoingEvents[0].end?.dateTime || ongoingEvents[0].end?.date || Date.now() + 3600000).getTime(),
        reminderMode: ongoingEvents[0].reminder_mode || 0,
      };
    }
    if (upcomingEvents && upcomingEvents.length > 0) {
      return {
        title: upcomingEvents[0].summary || 'Focus Session',
        isOngoing: false,
        startMs: new Date(upcomingEvents[0].start?.dateTime || upcomingEvents[0].start?.date || Date.now()).getTime(),
        endMs: new Date(upcomingEvents[0].end?.dateTime || upcomingEvents[0].end?.date || Date.now() + 3600000).getTime(),
        reminderMode: upcomingEvents[0].reminder_mode || 0,
      };
    }
    if (sqliteUpcomingEvent) {
      return {
        title: sqliteUpcomingEvent.title || 'Focus Session',
        isOngoing: false,
        startMs: sqliteUpcomingEvent.startTime,
        endMs: sqliteUpcomingEvent.endTime,
        reminderMode: sqliteUpcomingEvent.reminderMode,
      };
    }
    return null;
  }, [ongoingEvents, upcomingEvents, sqliteUpcomingEvent]);

  const nextSessionTimes = useMemo(() => {
    if (!nextSession) return '';
    const start = new Date(nextSession.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const end = new Date(nextSession.endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${start} – ${end}`;
  }, [nextSession]);

  const handleStartFocus = () => {
    const durationMin = nextSession
      ? Math.max(15, Math.round((nextSession.endMs - nextSession.startMs) / 60000))
      : 25;

    navigation.navigate(Routes.FOCUS, {
      sessionTitle: nextSession?.title || 'Quick Focus',
      durationMinutes: durationMin,
      startTime: nextSession?.startMs,
      endTime: nextSession?.endMs,
    });
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Theme.colors.primary]} />}
      >
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Text style={styles.wordmark}>Focus<Text style={styles.wordmark2}>Flow</Text></Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(Routes.SETTINGS)}
          style={styles.settingsButton}
          accessibilityLabel="Settings"
          activeOpacity={0.7}
        >
          {/* Settings Gear Icon */}
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

      {/* Screen Title & Date */}
      <View style={styles.titleSection}>
        <Text style={styles.titleText}>Today's Overview</Text>
        <Text style={styles.dateText}>{todayDateStr}</Text>
      </View>

      {/* Segmented Filter (Today / Week) */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          onPress={() => setSelectedPeriod('Today')}
          style={[styles.segmentBtn, selectedPeriod === 'Today' && styles.segmentBtnActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, selectedPeriod === 'Today' && styles.segmentTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedPeriod('Week')}
          style={[styles.segmentBtn, selectedPeriod === 'Week' && styles.segmentBtnActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, selectedPeriod === 'Week' && styles.segmentTextActive]}>Week</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Focus Goal Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroCardLabel}>
          {selectedPeriod === 'Today' ? 'Daily focus goal' : 'Weekly focus goal'}
        </Text>

        {/* Semicircular Gauge */}
        <View style={styles.gaugeContainer}>
          <Svg width={220} height={125} viewBox="0 0 220 125">
            {/* Background Arch */}
            <Path
              d="M 25 110 A 85 85 0 0 1 195 110"
              fill="none"
              stroke="#ECEEF8"
              strokeWidth={18}
              strokeLinecap="round"
            />
            {/* Active Progress Arch */}
            <Path
              d="M 25 110 A 85 85 0 0 1 195 110"
              fill="none"
              stroke="#5056D8"
              strokeWidth={18}
              strokeLinecap="round"
              strokeDasharray={`${(Math.PI * 85 * progressPercent) / 100} 500`}
            />
          </Svg>
          <View style={styles.gaugeTextOverlay}>
            <Text style={styles.gaugeValue}>
              {focusedMinutes} <Text style={styles.gaugeUnit}>min</Text>
            </Text>
            <Text style={styles.gaugeSubtitle}>of {effectiveGoalMin} min</Text>
          </View>
        </View>

        <View style={styles.gaugeFooter}>
          <Text style={styles.sessionsText}>
            {completedSessionsCount} {completedSessionsCount === 1 ? 'session' : 'sessions'} completed
          </Text>
          <Text style={styles.percentText}>
            {progressPercent}% of {selectedPeriod === 'Today' ? 'daily' : 'weekly'} goal
          </Text>
        </View>
      </View>

      {/* Metric Tiles Row */}
      <View style={styles.metricsRow}>
        {/* Screen Time Tile */}
        <View style={styles.metricTile}>
          <View style={styles.metricIconWrap}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Rect x={5} y={2} width={14} height={20} rx={3} stroke="#5056D8" strokeWidth={2} />
              <Line x1={11} y1={18} x2={13} y2={18} stroke="#5056D8" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.metricTileLabel}>Screen time</Text>
          <Text style={styles.metricTileValue}>
            {totalMs > 0 ? `${hours}h ${minutes}m` : '0m'}
          </Text>
        </View>

        {/* Unlocks Tile */}
        <View style={styles.metricTile}>
          <View style={styles.metricIconWrap}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Rect x={4} y={10} width={16} height={11} rx={2} stroke="#5056D8" strokeWidth={2} />
              <Path d="M7 10V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V10" stroke="#5056D8" strokeWidth={2} />
            </Svg>
          </View>
          <Text style={styles.metricTileLabel}>Unlocks</Text>
          <Text style={styles.metricTileValue}>{unlocksCount}</Text>
        </View>

        {/* Notifications Tile */}
        <View style={styles.metricTile}>
          <View style={styles.metricIconWrap}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#5056D8" strokeWidth={2} />
              <Path d="M13.73 21A2 2 0 0 1 10.27 21" stroke="#5056D8" strokeWidth={2} />
            </Svg>
          </View>
          <Text style={styles.metricTileLabel}>Notifications</Text>
          <Text style={styles.metricTileValue}>{notificationsCount}</Text>
        </View>
      </View>

      {/* Permission alert if needed */}
      {!hasPermission && (
        <TouchableOpacity
          style={styles.permissionCard}
          onPress={() => navigation.navigate('Permissions')}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionCardText}>Enable usage access to see real app analytics & unlocks ↗</Text>
        </TouchableOpacity>
      )}

      {/* Next Session Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Next session</Text>
        <TouchableOpacity onPress={() => navigation.navigate(Routes.SCHEDULE)} activeOpacity={0.7}>
          <Text style={styles.sectionLink}>View schedule ›</Text>
        </TouchableOpacity>
      </View>

      {nextSession ? (
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardTop}>
            <View style={styles.sessionIconWrap}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={5} width={18} height={16} rx={3} stroke="#FFFFFF" strokeWidth={2} />
                <Line x1={3} y1={10} x2={21} y2={10} stroke="#FFFFFF" strokeWidth={2} />
              </Svg>
            </View>
            <View style={styles.sessionInfoWrap}>
              <Text style={styles.sessionTitle} numberOfLines={1}>{nextSession.title}</Text>
              <Text style={styles.sessionTime}>{nextSessionTimes}</Text>
              <View style={styles.alarmStatusRow}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#D7DCFF" strokeWidth={2} />
                </Svg>
                <Text style={styles.alarmStatusText}>
                  {nextSession.reminderMode === 2 ? 'Alarm on' : nextSession.reminderMode === 1 ? 'Notification on' : 'Scheduled'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.startFocusBtn} onPress={handleStartFocus} activeOpacity={0.85}>
            <Text style={styles.startFocusText}>Start Focus</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptySessionCard}>
          <Text style={styles.emptySessionTitle}>No upcoming sessions</Text>
          <Text style={styles.emptySessionSubtitle}>Sync Google Calendar or schedule in the Schedule tab.</Text>
        </View>
      )}

      {/* Most Used Apps Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Most used apps</Text>
      </View>

      <View style={styles.appsCard}>
        {topApps.length > 0 ? (
          topApps.map((app, index) => {
            const minutesUsed = Math.max(1, Math.round(app.durationMs / 60000));
            const progress = Math.min(100, Math.round((minutesUsed / 60) * 100));
            const displayName = app.packageName.split('.').pop() || app.packageName;

            return (
              <View key={app.packageName} style={[styles.appRow, index < topApps.length - 1 && styles.appRowBorder]}>
                <View style={styles.appIconBadge}>
                  <Text style={styles.appIconChar}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.appInfoCol}>
                  <View style={styles.appHeaderRow}>
                    <Text style={styles.appNameText}>{displayName}</Text>
                    <Text style={styles.appDurationText}>{minutesUsed}m</Text>
                  </View>
                  <View style={styles.appProgressBarTrack}>
                    <View style={[styles.appProgressBarFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.noAppsContainer}>
            <Text style={styles.noAppsText}>
              {hasPermission
                ? `No recorded app usage for ${selectedPeriod.toLowerCase()}.`
                : 'Grant usage stats permission to view app breakdown.'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  </>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF', // Canvas very pale lavender
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    position:"static",
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    color: '#20283A',
    letterSpacing: -0.3,
    position:"static"
  },
  wordmark2: {
    fontSize: 20,
    fontWeight: '800',
    color: '#004cffff',
    letterSpacing: -0.3,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  titleSection: {
    marginBottom: 16,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#20283A',
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 14,
    color: '#727A91',
    marginTop: 2,
    fontWeight: '500',
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
    backgroundColor: '#5056D8', // Indigo active
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
  heroCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#20283A',
    marginBottom: 10,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 125,
  },
  gaugeTextOverlay: {
    position: 'absolute',
    bottom: 12,
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#20283A',
    letterSpacing: -0.5,
  },
  gaugeUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: '#727A91',
  },
  gaugeSubtitle: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
    marginTop: -2,
  },
  gaugeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F2FA',
  },
  sessionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#20283A',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#727A91',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricTileLabel: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricTileValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#20283A',
  },
  permissionCard: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  permissionCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#20283A',
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5056D8',
  },
  sessionCard: {
    backgroundColor: '#5056D8', // Indigo accent card
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    ...Platform.select({
      android: { elevation: 3 },
      ios: { shadowColor: '#5056D8', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sessionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sessionInfoWrap: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sessionTime: {
    fontSize: 13,
    color: '#E0E4FF',
    fontWeight: '500',
  },
  alarmStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  alarmStatusText: {
    fontSize: 11,
    color: '#D7DCFF',
    fontWeight: '500',
  },
  startFocusBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startFocusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5056D8',
  },
  emptySessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    marginBottom: 20,
    alignItems: 'center',
    
  },
  emptySessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
  },
  emptySessionSubtitle: {
    fontSize: 12,
    color: '#727A91',
    marginTop: 2,
  },
  appsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  appRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2FA',
  },
  appIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appIconChar: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5056D8',
  },
  appInfoCol: {
    flex: 1,
  },
  appHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  appNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
  },
  appDurationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#727A91',
  },
  appProgressBarTrack: {
    height: 6,
    backgroundColor: '#F0F2FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  appProgressBarFill: {
    height: '100%',
    backgroundColor: '#5056D8',
    borderRadius: 3,
  },
  noAppsContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noAppsText: {
    fontSize: 13,
    color: '#727A91',
    textAlign: 'center',
  },
});
