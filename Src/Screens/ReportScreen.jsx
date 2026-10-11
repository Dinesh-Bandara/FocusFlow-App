import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModules } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Rect, Circle, Line, Polyline } from 'react-native-svg';
import { Theme } from '../Theme/Theme';
import { FocusStorageService } from '../Services/FocusStorageService';

const { NativeTracking } = NativeModules;

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;

  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0); // 0 = current week, -1 = last week
  const [loading, setLoading] = useState(false);

  // Live weekly focus metrics from SQLite
  const [weeklyFocusData, setWeeklyFocusData] = useState({
    totalFocusMinutes: 0,
    totalHours: 0,
    completedCount: 0,
    totalCount: 0,
    completionRate: 0,
    chartData: [],
    trendBadge: 'No sessions yet',
    hasSessions: false,
  });

  // Weekly unlocks and screen time
  const [weeklyUnlocks, setWeeklyUnlocks] = useState(0);
  const [weeklyNotifications, setWeeklyNotifications] = useState(0);
  const [weeklyUsageMs, setWeeklyUsageMs] = useState(0);

  // Derive dynamic date boundaries for selected week
  const weekRange = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + selectedWeekOffset * 7);

    const currentDay = now.getDay();
    const monday = new Date(now);
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Prior week
    const priorMonday = new Date(monday);
    priorMonday.setDate(monday.getDate() - 7);
    const priorSunday = new Date(monday);
    priorSunday.setDate(monday.getDate() - 1);
    priorSunday.setHours(23, 59, 59, 999);

    const monDate = monday.getDate();
    const sunDate = sunday.getDate();
    const monthName = sunday.toLocaleDateString('en-US', { month: 'long' });

    return {
      weekStartMs: monday.getTime(),
      weekEndMs: sunday.getTime(),
      priorWeekStartMs: priorMonday.getTime(),
      priorWeekEndMs: priorSunday.getTime(),
      displayStr: `${monDate} – ${sunDate} ${monthName}`,
    };
  }, [selectedWeekOffset]);

  const loadWeeklyReport = useCallback(async () => {
    try {
      // 1. SQLite Focus Sessions for the week
      const summary = await FocusStorageService.getWeeklyFocusSummary(
        weekRange.weekStartMs,
        weekRange.weekEndMs,
        weekRange.priorWeekStartMs,
        weekRange.priorWeekEndMs
      );
      setWeeklyFocusData(summary);

      // 2. Native Tracking for the week
      if (NativeTracking) {
        if (NativeTracking.getUnlockCountRange) {
          const unlocks = await NativeTracking.getUnlockCountRange(
            weekRange.weekStartMs,
            weekRange.weekEndMs
          );
          setWeeklyUnlocks(unlocks || 0);
        }

        if (NativeTracking.getUsageRange) {
          const usage = await NativeTracking.getUsageRange(
            weekRange.weekStartMs,
            weekRange.weekEndMs
          );
          const totalMs = Object.values(usage || {}).reduce((acc, curr) => acc + Number(curr), 0);
          setWeeklyUsageMs(totalMs);
        }
      }
    } catch (e) {
      console.warn('Failed to load weekly report:', e);
    }
  }, [weekRange]);

  useFocusEffect(
    useCallback(() => {
      loadWeeklyReport();
    }, [loadWeeklyReport])
  );

  const onRefresh = async () => {
    setLoading(true);
    await loadWeeklyReport();
    setLoading(false);
  };

  // Screen time daily average
  const dailyAverageHours = Math.floor(weeklyUsageMs / (7 * 3600000));
  const dailyAverageMinutes = Math.floor((weeklyUsageMs % (7 * 3600000)) / (7 * 60000));

  // Find peak day in chartData
  const peakMinutes = useMemo(() => {
    if (!weeklyFocusData.chartData || weeklyFocusData.chartData.length === 0) return 0;
    return Math.max(...weeklyFocusData.chartData.map((d) => d.minutes), 0);
  }, [weeklyFocusData.chartData]);

  // Formatted total focus time
  const focusHours = Math.floor(weeklyFocusData.totalFocusMinutes / 60);
  const focusMins = weeklyFocusData.totalFocusMinutes % 60;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Theme.colors.primary]} />}
      >
        {/* Screen Header */}
        <View style={styles.headerSection}>
          <Text style={styles.titleText}>Weekly Report</Text>
          <Text style={styles.subtitleText}>Small steps, clearer focus</Text>
        </View>

        {/* Week Selector */}
        <View style={styles.weekSelectorRow}>
          <TouchableOpacity
            onPress={() => setSelectedWeekOffset((w) => w - 1)}
            style={styles.weekNavBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.weekNavArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekRangeText}>{weekRange.displayStr}</Text>
          <TouchableOpacity
            onPress={() => setSelectedWeekOffset((w) => Math.min(0, w + 1))}
            style={[styles.weekNavBtn, selectedWeekOffset >= 0 && styles.weekNavBtnDisabled]}
            activeOpacity={0.7}
            disabled={selectedWeekOffset >= 0}
          >
            <Text style={[styles.weekNavArrow, selectedWeekOffset >= 0 && styles.weekNavArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Recorded Focus Time Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Recorded focus time</Text>
          <Text style={styles.heroTimeValue}>
            {focusHours > 0 || focusMins > 0 ? `${focusHours}h ${focusMins}m` : '0h 0m'}
          </Text>

          <View style={styles.trendGreenRow}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M7 17L17 7M17 7H7M17 7V17" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.trendGreenText}>{weeklyFocusData.trendBadge}</Text>
          </View>

          {/* 7-Day Focus Bar Chart */}
          <View style={styles.barChartContainer}>
            <View style={styles.barsRow}>
              {weeklyFocusData.chartData && weeklyFocusData.chartData.length > 0 ? (
                weeklyFocusData.chartData.map((item) => {
                  const max = Math.max(peakMinutes, 60); // minimum 60 min ceiling for display
                  const heightPercent = Math.min(100, Math.max(8, Math.round((item.minutes / max) * 100)));
                  const isHighlight = item.minutes > 0 && item.minutes === peakMinutes;
                  const timeStr = item.minutes > 0 ? `${Math.floor(item.minutes / 60)}h ${item.minutes % 60}m` : '0m';

                  return (
                    <View key={item.label} style={styles.barCol}>
                      <Text style={styles.barValueText}>{item.minutes > 0 ? timeStr : ''}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPercent}%` },
                            isHighlight && styles.barFillHighlight,
                          ]}
                        />
                      </View>
                      <Text style={styles.barDayLabel}>{item.label}</Text>
                    </View>
                  );
                })
              ) : (
                ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <View key={day} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: '8%' }]} />
                    </View>
                    <Text style={styles.barDayLabel}>{day}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {!weeklyFocusData.hasSessions && (
            <Text style={styles.emptySessionsNotice}>
              No completed focus sessions recorded for this week. Use the Focus tab to log sessions.
            </Text>
          )}
        </View>

        {/* Two Side-by-Side Performance Cards */}
        <View style={styles.twoCardsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricCheckBadge}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17L4 12" stroke="#5056D8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.metricValueLarge}>
              {weeklyFocusData.completedCount} / {weeklyFocusData.totalCount}
            </Text>
            <Text style={styles.metricSubtitle}>Sessions completed</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricChartBadge}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={12} width={4} height={9} rx={1} stroke="#5056D8" strokeWidth={2} />
                <Rect x={10} y={7} width={4} height={14} rx={1} stroke="#5056D8" strokeWidth={2} />
                <Rect x={17} y={3} width={4} height={18} rx={1} stroke="#5056D8" strokeWidth={2} />
              </Svg>
            </View>
            <Text style={styles.metricValueLarge}>{weeklyFocusData.completionRate}%</Text>
            <Text style={styles.metricSubtitle}>Completion rate</Text>
          </View>
        </View>

        {/* Screen Time Trend Card */}
        <View style={styles.screenTimeCard}>
          <Text style={styles.screenTimeLabel}>Screen time</Text>
          <Text style={styles.screenTimeAverage}>
            {dailyAverageHours}h {dailyAverageMinutes}m <Text style={styles.averageSub}>daily average</Text>
          </Text>

          {/* Visual Line Chart Graphic */}
          <View style={styles.lineChartWrap}>
            <Svg width="100%" height={120} viewBox="0 0 310 120">
              {/* Grid Lines */}
              <Line x1="10" y1="20" x2="300" y2="20" stroke="#F0F2FA" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="10" y1="50" x2="300" y2="50" stroke="#F0F2FA" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="10" y1="80" x2="300" y2="80" stroke="#F0F2FA" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="10" y1="110" x2="300" y2="110" stroke="#ECEEF5" strokeWidth="1" />

              {/* Gradient Fill under line */}
              <Polyline
                points="20,40 65,50 110,45 155,65 200,60 245,75 290,85 290,110 20,110"
                fill="rgba(115, 133, 255, 0.12)"
                stroke="none"
              />

              {/* Trend Line */}
              <Polyline
                points="20,40 65,50 110,45 155,65 200,60 245,75 290,85"
                fill="none"
                stroke="#5056D8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Dots */}
              {[[20, 40], [65, 50], [110, 45], [155, 65], [200, 60], [245, 75], [290, 85]].map(([cx, cy], i) => (
                <Circle key={i} cx={cx} cy={cy} r="4" fill="#FFFFFF" stroke="#5056D8" strokeWidth={2.5} />
              ))}
            </Svg>
            <View style={styles.lineChartDaysRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <Text key={day} style={styles.lineChartDay}>{day}</Text>
              ))}
            </View>
          </View>
        </View>

        {/* Weekly Totals Card */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsHeader}>Weekly totals</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalCol}>
              <View style={styles.totalIconWrap}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Rect x={5} y={2} width={14} height={20} rx={3} stroke="#5056D8" strokeWidth={2} />
                  <Line x1={11} y1={18} x2={13} y2={18} stroke="#5056D8" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </View>
              <View>
                <Text style={styles.totalValue}>{weeklyUnlocks}</Text>
                <Text style={styles.totalLabel}>Unlocks</Text>
              </View>
            </View>

            <View style={styles.totalsDivider} />

            <View style={styles.totalCol}>
              <View style={styles.totalIconWrap}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#5056D8" strokeWidth={2} />
                  <Path d="M13.73 21A2 2 0 0 1 10.27 21" stroke="#5056D8" strokeWidth={2} />
                </Svg>
              </View>
              <View>
                <Text style={styles.totalValue}>{weeklyNotifications}</Text>
                <Text style={styles.totalLabel}>Notifications</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pale Lavender Insight Banner */}
        <View style={styles.insightBanner}>
          <View style={styles.insightIconBadge}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M3 3V21H21" stroke="#5056D8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M7 14L12 9L16 13L21 8" stroke="#5056D8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.insightText}>
            {weeklyFocusData.hasSessions
              ? `Completed ${weeklyFocusData.completedCount} focus sessions with a ${weeklyFocusData.completionRate}% completion rate.`
              : 'Build focus habits by running focus sessions throughout the week.'}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF', // Pale lavender canvas
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerSection: {
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
  weekSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  weekNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekNavBtnDisabled: {
    opacity: 0.3,
  },
  weekNavArrow: {
    fontSize: 20,
    color: '#20283A',
    fontWeight: '700',
  },
  weekNavArrowDisabled: {
    color: '#727A91',
  },
  weekRangeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#20283A',
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
  trendGreenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 16,
  },
  trendGreenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  barChartContainer: {
    marginTop: 10,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barValueText: {
    fontSize: 9,
    color: '#727A91',
    fontWeight: '500',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 75,
    backgroundColor: '#F0F2FA',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#7385FF', // Periwinkle default
    borderRadius: 6,
  },
  barFillHighlight: {
    backgroundColor: '#5056D8', // Indigo peak
  },
  barDayLabel: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 6,
  },
  emptySessionsNotice: {
    fontSize: 12,
    color: '#727A91',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  twoCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  metricCheckBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricChartBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValueLarge: {
    fontSize: 20,
    fontWeight: '800',
    color: '#20283A',
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 2,
  },
  screenTimeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  screenTimeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#727A91',
  },
  screenTimeAverage: {
    fontSize: 24,
    fontWeight: '800',
    color: '#20283A',
    marginTop: 2,
    marginBottom: 14,
  },
  averageSub: {
    fontSize: 14,
    fontWeight: '500',
    color: '#727A91',
  },
  lineChartWrap: {
    marginTop: 4,
  },
  lineChartDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  lineChartDay: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
  },
  totalsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  totalsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
    marginBottom: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalsDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#ECEEF5',
    marginHorizontal: 12,
  },
  totalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0F2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#20283A',
  },
  totalLabel: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF1FF',
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  insightIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#20283A',
    fontWeight: '500',
  },
});
