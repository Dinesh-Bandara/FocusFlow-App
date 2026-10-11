import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useCalendar } from '../Hooks/useCalendar';
import { useScheduleLifecycle } from '../Hooks/useScheduleLifecycle';
import { useNavigation } from '@react-navigation/native';
import { Routes } from '../Constants/Routes';
import { Theme } from '../Theme/Theme';

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;

  const { events, loading, currentUser, login, logout, refreshEvents, error } = useCalendar();
  const { upcoming, ongoing } = useScheduleLifecycle(events);
  const navigation = useNavigation();

  const [selectedTab, setSelectedTab] = useState('Upcoming'); // 'Upcoming' | 'History'
  const [selectedDayIndex, setSelectedDayIndex] = useState(6); // default to Sunday (today in week)

  // Derive dynamic 7-day strip for the current week
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday
    // Find Monday of the current week
    const monday = new Date(now);
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(now.getDate() + distanceToMonday);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        name: dayNames[i],
        dateNum: d.getDate(),
        fullDate: d,
        isToday: d.toDateString() === now.toDateString(),
      });
    }
    return days;
  }, []);

  // Formatted month and header info
  const { monthYearStr, todayDateFullStr, currentTimeStr } = useMemo(() => {
    const now = new Date();
    return {
      monthYearStr: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      todayDateFullStr: now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
      currentTimeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }, []);

  const handleTestAlarm = async (mode) => {
    try {
      const { ReminderService } = require('../Services/ReminderService');
      await ReminderService.testReminder(mode);
      Alert.alert(
        mode === 2 ? '⏰ Test Alarm Scheduled' : '🔔 Test Notification Scheduled',
        'Alarm will fire in 5 SECONDS! Lock your phone or swipe the app closed to test background ringing.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Test Error', e.message || 'Failed to trigger test.');
    }
  };

  const handleSetReminder = async (event, mode) => {
    try {
      const startMs = new Date(event.start?.dateTime || event.start?.date || Date.now()).getTime();
      const { ReminderService } = require('../Services/ReminderService');
      await ReminderService.setReminder(event.id, event.summary, startMs, mode, 5);

      if (mode === 2) {
        Alert.alert('⏰ Alarm Active', `Alarm set for "${event.summary}".`);
      } else if (mode === 1) {
        Alert.alert('🔔 Notification Active', `Notification set for "${event.summary}".`);
      } else {
        Alert.alert('🔕 Reminder Off', 'Reminder turned off.');
      }
      refreshEvents();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update reminder.');
    }
  };

  const handleStartFocus = (event) => {
    navigation.navigate(Routes.FOCUS, {
      sessionTitle: event?.summary || 'Focus Session',
      durationMinutes: 45,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#5056D8" translucent={true} />
      {/* Indigo Top Header */}
      <View style={[styles.indigoHeader, { paddingTop: topPadding }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Schedule</Text>
            <TouchableOpacity style={styles.monthSelectorRow} activeOpacity={0.7}>
              <Text style={styles.monthText}>{monthYearStr}</Text>
              <Text style={styles.chevronIcon}>▾</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={refreshEvents} style={styles.iconButton} activeOpacity={0.7}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M1 4V10H7" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M3.51 15A9 9 0 1 0 5.64 5.64L1 10" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {currentUser && (
              <TouchableOpacity onPress={logout} style={styles.logoutSmallBtn} activeOpacity={0.7}>
                <Text style={styles.logoutSmallText}>Logout</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 7-Day Strip */}
        <View style={styles.weekStrip}>
          {weekDays.map((item, index) => {
            const isSelected = selectedDayIndex === index;
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => setSelectedDayIndex(index)}
                style={[styles.dayColumn, isSelected && styles.dayColumnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{item.name}</Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{item.dateNum}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Curved White Surface */}
      <View style={styles.whiteSurface}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Header */}
          <View style={styles.surfaceHeaderRow}>
            <View>
              <Text style={styles.surfaceDateTitle}>{todayDateFullStr}</Text>
              <Text style={styles.syncStatusText}>
                {loading ? 'Syncing calendar...' : 'Synced just now'}
              </Text>
            </View>
          </View>

          {/* Segmented Filter: Upcoming / History */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              onPress={() => setSelectedTab('Upcoming')}
              style={[styles.segmentBtn, selectedTab === 'Upcoming' && styles.segmentBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, selectedTab === 'Upcoming' && styles.segmentTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedTab('History')}
              style={[styles.segmentBtn, selectedTab === 'History' && styles.segmentBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, selectedTab === 'History' && styles.segmentTextActive]}>
                History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Test Bar (Restricted to Development Builds) */}
          {__DEV__ && (
            <View style={styles.quickTestBox}>
              <Text style={styles.quickTestTitle}>Quick Test (fires in 5s):</Text>
              <View style={styles.quickTestRow}>
                <TouchableOpacity
                  style={styles.quickTestBtnPrimary}
                  onPress={() => handleTestAlarm(2)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickTestBtnTextPrimary}>⏰ Test Alarm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTestBtnSecondary}
                  onPress={() => handleTestAlarm(1)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickTestBtnTextSecondary}>🔔 Test Notif</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Google Sign-in Banner if not signed in */}
          {!currentUser && (
            <View style={styles.loginBanner}>
              <Text style={styles.loginTitle}>Connect Google Calendar</Text>
              <Text style={styles.loginSubtitle}>Sign in to view real scheduled events and set automatic alarms.</Text>
              <TouchableOpacity style={styles.loginBtn} onPress={login} activeOpacity={0.85}>
                <Text style={styles.loginBtnText}>Sign In with Google</Text>
              </TouchableOpacity>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Timeline View */}
          <View style={styles.timelineContainer}>
            {/* 09:00 - 09:30 Ongoing Item */}
            <View style={styles.timelineRow}>
              <View style={styles.gutter}>
                <Text style={styles.timeLabel}>09:00</Text>
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.ongoingCard}>
                  <View style={styles.eventTimeHeaderRow}>
                    <Text style={styles.cardTimeLabel}>09:00 – 09:30</Text>
                  </View>
                  <Text style={styles.cardEventTitle}>Daily Planning</Text>
                  <View style={styles.ongoingFooterRow}>
                    <View style={styles.statusPill}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Ongoing</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.continueBtn}
                      onPress={() => handleStartFocus({ summary: 'Daily Planning' })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.continueBtnText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Current Time Indicator line */}
            <View style={styles.currentTimeRow}>
              <View style={styles.gutter}>
                <Text style={styles.currentTimeLabel}>{currentTimeStr}</Text>
              </View>
              <View style={styles.currentTimeIndicatorLine}>
                <View style={styles.currentTimeDot} />
                <View style={styles.currentLine} />
              </View>
            </View>

            {/* 09:30 - 10:00 JFT Quick Review */}
            <View style={styles.timelineRow}>
              <View style={styles.gutter}>
                <Text style={styles.timeLabel}>09:30</Text>
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.upcomingCard}>
                  <Text style={styles.cardTimeLabel}>09:30 – 10:00</Text>
                  <Text style={styles.cardEventTitle}>JFT Quick Review</Text>
                  <View style={styles.alarmStatusRow}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#727A91" strokeWidth={2} />
                    </Svg>
                    <Text style={styles.alarmLabel}>Alarm on</Text>
                  </View>
                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      style={styles.startFocusCardBtn}
                      onPress={() => handleStartFocus({ summary: 'JFT Quick Review' })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.startFocusCardText}>Start Focus</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reminderSettingsLink}
                      onPress={() => handleSetReminder({ id: 'jft', summary: 'JFT Quick Review' }, 2)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reminderSettingsText}>Reminder settings ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* 10:30 - 11:30 Deep Work */}
            <View style={styles.timelineRow}>
              <View style={styles.gutter}>
                <Text style={styles.timeLabel}>10:30</Text>
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.futureCard}>
                  <Text style={styles.cardTimeLabel}>10:30 – 11:30</Text>
                  <Text style={styles.cardEventTitle}>Deep Work</Text>
                  <View style={styles.alarmStatusRow}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="#727A91" strokeWidth={2} />
                    </Svg>
                    <Text style={styles.alarmLabel}>Notification only</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Additional Google Calendar Live Events */}
            {events && events.length > 0 && (
              events.slice(0, 3).map((item) => {
                const startTime = item.start?.dateTime ? new Date(item.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day';
                const endTime = item.end?.dateTime ? new Date(item.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.gutter}>
                      <Text style={styles.timeLabel}>{startTime}</Text>
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.futureCard}>
                        <Text style={styles.cardTimeLabel}>{endTime ? `${startTime} – ${endTime}` : startTime}</Text>
                        <Text style={styles.cardEventTitle}>{item.summary || 'Busy'}</Text>
                        <View style={styles.cardActionRow}>
                          <TouchableOpacity
                            style={styles.startFocusCardBtn}
                            onPress={() => handleStartFocus(item)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.startFocusCardText}>Start Focus</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            <View style={styles.timelineRow}>
              <View style={styles.gutter}><Text style={styles.timeLabel}>12:00</Text></View>
              <View style={styles.timelineEmpty} />
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.gutter}><Text style={styles.timeLabel}>13:00</Text></View>
              <View style={styles.timelineEmpty} />
            </View>
          </View>

          {/* Calendar Source Chip */}
          <View style={styles.calendarSourceChip}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={5} width={18} height={16} rx={3} stroke="#5056D8" strokeWidth={2} />
              <Line x1={3} y1={10} x2={21} y2={10} stroke="#5056D8" strokeWidth={2} />
            </Svg>
            <Text style={styles.calendarSourceText}>Personal calendar ▾</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5056D8', // Indigo base
  },
  indigoHeader: {
    backgroundColor: '#5056D8',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  monthSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  monthText: {
    fontSize: 14,
    color: '#E0E4FF',
    fontWeight: '500',
  },
  chevronIcon: {
    fontSize: 12,
    color: '#E0E4FF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoutSmallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoutSmallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dayColumn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  dayColumnActive: {
    backgroundColor: '#FFFFFF', // White active pill
  },
  dayName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#E0E4FF',
    marginBottom: 4,
  },
  dayNameActive: {
    color: '#5056D8',
    fontWeight: '700',
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayNumActive: {
    color: '#5056D8',
  },
  whiteSurface: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  surfaceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  surfaceDateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#20283A',
  },
  syncStatusText: {
    fontSize: 12,
    color: '#727A91',
    marginTop: 2,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8ECF8',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
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
  quickTestBox: {
    backgroundColor: '#F0F2FF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D7DCFF',
  },
  quickTestTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5056D8',
    marginBottom: 8,
  },
  quickTestRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickTestBtnPrimary: {
    flex: 1,
    backgroundColor: '#5056D8',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickTestBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  quickTestBtnSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7DCFF',
  },
  quickTestBtnTextSecondary: {
    color: '#5056D8',
    fontWeight: '600',
    fontSize: 12,
  },
  loginBanner: {
    backgroundColor: '#EEF1FF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  loginTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 4,
  },
  loginSubtitle: {
    fontSize: 12,
    color: '#727A91',
    textAlign: 'center',
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: '#5056D8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    textAlign: 'center',
  },
  timelineContainer: {
    marginTop: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  gutter: {
    width: 48,
    paddingTop: 4,
  },
  timeLabel: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
  },
  timelineContent: {
    flex: 1,
  },
  timelineEmpty: {
    flex: 1,
    height: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2FA',
  },
  ongoingCard: {
    backgroundColor: '#F7F8FF',
    borderRadius: 20,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5056D8',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  cardTimeLabel: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
    marginBottom: 2,
  },
  cardEventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 8,
  },
  ongoingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5056D8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5056D8',
  },
  continueBtn: {
    backgroundColor: '#5056D8',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  currentTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  currentTimeLabel: {
    fontSize: 12,
    color: '#5056D8',
    fontWeight: '700',
  },
  currentTimeIndicatorLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5056D8',
    marginRight: 6,
  },
  currentLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#7385FF',
  },
  upcomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5056D8',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  alarmStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  alarmLabel: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  startFocusCardBtn: {
    backgroundColor: '#5056D8',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  startFocusCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reminderSettingsLink: {
    paddingVertical: 4,
  },
  reminderSettingsText: {
    fontSize: 12,
    color: '#5056D8',
    fontWeight: '600',
  },
  futureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  calendarSourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F7F8FF',
    alignSelf: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  calendarSourceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#20283A',
  },
});
