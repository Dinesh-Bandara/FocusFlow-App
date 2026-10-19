import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useCalendar } from '../Hooks/useCalendar';
import { ReminderService } from '../Services/ReminderService';
import { useNavigation } from '@react-navigation/native';
import { Routes } from '../Constants/Routes';

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 10;
  const navigation = useNavigation();

  const { events, loading, currentUser, lastSyncTime, login, logout, refreshEvents, error } = useCalendar();

  // Authoritative selected date (defaults to today's local date)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Current real-time clock for accurate live timeline
  const [now, setNow] = useState(() => new Date());
  const scrollViewRef = useRef(null);

  // Update clock every 30 seconds & on foreground return
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(new Date());
      }
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  // Today check
  const isSelectedDateToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate()
    );
  }, [selectedDate, now]);

  const isSelectedDatePast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = new Date(selectedDate);
    sel.setHours(0, 0, 0, 0);
    return sel.getTime() < today.getTime();
  }, [selectedDate, now]);

  // Weekdays strip calculation based on selectedDate's week (Monday through Sunday)
  const weekDays = useMemo(() => {
    const sel = new Date(selectedDate);
    const dayOfWeek = sel.getDay(); // 0 = Sun, 1 = Mon ...
    const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(sel);
    monday.setDate(sel.getDate() + distToMonday);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isSelected =
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate();
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();

      days.push({
        name: dayNames[i],
        dateNum: d.getDate(),
        fullDate: d,
        isSelected,
        isToday,
      });
    }
    return days;
  }, [selectedDate]);

  // Derived date labels
  const monthYearStr = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedDate]);

  const displayedDateHeading = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  const currentTimeStr = useMemo(() => {
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [now]);

  // Sync state label
  const syncLabel = useMemo(() => {
    if (loading) return 'Syncing calendar...';
    if (!lastSyncTime) return 'Tap refresh to sync';
    const diffSec = Math.floor((now.getTime() - lastSyncTime) / 1000);
    if (diffSec < 60) return 'Synced just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Synced ${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `Synced ${diffHours}h ago`;
  }, [loading, lastSyncTime, now]);

  // Navigation handlers
  const handlePrevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 7);
    setSelectedDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
  };

  const handleReturnToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  };

  // Filter events for the authoritative selectedDate
  const { allDayEvents, timedEvents } = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endOfDayMs = endOfDay.getTime();

    const allDay = [];
    const timed = [];

    (events || []).forEach(e => {
      const sMs = e.startTimeMs || (e.start?.dateTime ? new Date(e.start.dateTime).getTime() : 0);
      const eMs = e.endTimeMs || (e.end?.dateTime ? new Date(e.end.dateTime).getTime() : 0);

      // Event overlaps selected day if sMs <= endOfDayMs and eMs >= startOfDayMs
      if (sMs <= endOfDayMs && eMs >= startOfDayMs) {
        if (e.isAllDay) {
          allDay.push(e);
        } else {
          timed.push(e);
        }
      }
    });

    // Sort timed events by actual start timestamp
    timed.sort((a, b) => a.startTimeMs - b.startTimeMs);

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, selectedDate]);

  // For Today view: automatically hide ended events from today's active schedule
  const activeTimelineEvents = useMemo(() => {
    if (!isSelectedDateToday) {
      return timedEvents;
    }
    const nowMs = now.getTime();
    // Filter out ended tasks on today's active timeline
    return timedEvents.filter(e => e.endTimeMs > nowMs);
  }, [timedEvents, isSelectedDateToday, now]);

  // Handle toggling reminder modes (2 = Alarm, 1 = Notification, 0 = Off)
  const handleToggleReminder = async (item, targetMode) => {
    try {
      await ReminderService.setReminder(
        item.id,
        item.summary || item.title || 'Focus Session',
        item.startTimeMs,
        item.endTimeMs,
        targetMode,
        0
      );
      refreshEvents();
    } catch (e) {
      Alert.alert('Reminder Error', e.message || 'Could not update reminder.');
    }
  };

  // Start Focus session navigation with real calendar slot durations
  const handleStartFocus = (item) => {
    const s = item.startTimeMs;
    const e = item.endTimeMs;
    const durationMin = Math.max(1, Math.round((e - s) / 60000));

    navigation.navigate('MainTabs', {
      screen: Routes.FOCUS,
      params: {
        eventId: item.id,
        sessionTitle: item.summary || item.title || 'Focus Session',
        startTime: s,
        endTime: e,
        durationMinutes: durationMin,
      },
    });
  };

  // Format time range (e.g. "09:00 – 09:30")
  const formatTimeRange = (startMs, endMs) => {
    const s = new Date(startMs);
    const e = new Date(endMs);
    const pad = n => (n < 10 ? '0' + n : n);
    return `${pad(s.getHours())}:${pad(s.getMinutes())} – ${pad(e.getHours())}:${pad(e.getMinutes())}`;
  };

  const formatHourOnly = (startMs) => {
    const s = new Date(startMs);
    const pad = n => (n < 10 ? '0' + n : n);
    return `${pad(s.getHours())}:${pad(s.getMinutes())}`;
  };

  // Determine current-time line insertion point among activeTimelineEvents
  const currentTimeInsertIndex = useMemo(() => {
    if (!isSelectedDateToday) return -1;
    const nowMs = now.getTime();
    for (let i = 0; i < activeTimelineEvents.length; i++) {
      if (nowMs < activeTimelineEvents[i].startTimeMs) {
        return i;
      }
    }
    return activeTimelineEvents.length;
  }, [activeTimelineEvents, isSelectedDateToday, now]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#5056D8" translucent={true} />

      {/* FIXED INDIGO HEADER */}
      <View style={[styles.indigoHeader, { paddingTop: topPadding }]}>
        {/* Title, Month/Week controls, Refresh & Logout */}
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Schedule</Text>
            <View style={styles.monthSelectorRow}>
              <TouchableOpacity onPress={handlePrevWeek} style={styles.weekNavBtn} activeOpacity={0.7}>
                <Text style={styles.weekNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthText}>{monthYearStr}</Text>
              <TouchableOpacity onPress={handleNextWeek} style={styles.weekNavBtn} activeOpacity={0.7}>
                <Text style={styles.weekNavText}>›</Text>
              </TouchableOpacity>
              {!isSelectedDateToday && (
                <TouchableOpacity onPress={handleReturnToday} style={styles.todayPill} activeOpacity={0.75}>
                  <Text style={styles.todayPillText}>Today</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={refreshEvents} style={styles.iconButton} activeOpacity={0.7}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M1 4V10H7" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M3.51 15A9 9 0 1 0 5.64 5.64L1 10" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </TouchableOpacity>
            {currentUser ? (
              <TouchableOpacity onPress={logout} style={styles.logoutSmallBtn} activeOpacity={0.7}>
                <Text style={styles.logoutSmallText}>Logout</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={login} style={styles.logoutSmallBtn} activeOpacity={0.7}>
                <Text style={styles.logoutSmallText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 7-DAY WEEK STRIP */}
        <View style={styles.weekStrip}>
          {weekDays.map(item => {
            return (
              <TouchableOpacity
                key={item.fullDate.toDateString()}
                onPress={() => setSelectedDate(item.fullDate)}
                style={[styles.dayColumn, item.isSelected && styles.dayColumnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayName, item.isSelected && styles.dayNameActive]}>{item.name}</Text>
                <Text style={[styles.dayNum, item.isSelected && styles.dayNumActive]}>{item.dateNum}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SCROLLING TIMELINE SURFACE */}
      <View style={styles.whiteSurface}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Surface Header (Date title and sync status) */}
          <View style={styles.surfaceHeaderRow}>
            <View>
              <Text style={styles.surfaceDateTitle}>{displayedDateHeading}</Text>
              <Text style={styles.syncStatusText}>{syncLabel}</Text>
            </View>
            {!currentUser && (
              <TouchableOpacity style={styles.connectLink} onPress={login} activeOpacity={0.8}>
                <Text style={styles.connectLinkText}>+ Connect Google</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Error Banner if any */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ALL-DAY EVENTS SECTION (Clean separate cards) */}
          {allDayEvents.length > 0 && (
            <View style={styles.allDayContainer}>
              <Text style={styles.allDaySectionTitle}>All-Day Events</Text>
              {allDayEvents.map(item => (
                <View key={item.id} style={styles.allDayCard}>
                  <View style={styles.allDayDot} />
                  <Text style={styles.allDayTitle} numberOfLines={1}>
                    {item.summary || item.title || 'All-Day Event'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* TIMELINE */}
          <View style={styles.timelineContainer}>
            {/* If today and current time is before the first active event */}
            {isSelectedDateToday && currentTimeInsertIndex === 0 && (
              <View style={styles.currentTimeRow}>
                <View style={styles.gutter}>
                  <Text style={styles.currentTimeLabel}>{currentTimeStr}</Text>
                </View>
                <View style={styles.currentTimeIndicatorLine}>
                  <View style={styles.currentTimeDot} />
                  <View style={styles.currentLine} />
                </View>
              </View>
            )}

            {/* Render Timed Events */}
            {activeTimelineEvents.length > 0 ? (
              activeTimelineEvents.map((item, index) => {
                const nowMs = now.getTime();
                const isOngoing = item.startTimeMs <= nowMs && nowMs < item.endTimeMs;
                const isUpcoming = nowMs < item.startTimeMs;
                const isPast = nowMs >= item.endTimeMs;

                const timeLabel = formatHourOnly(item.startTimeMs);
                const timeRange = formatTimeRange(item.startTimeMs, item.endTimeMs);

                return (
                  <React.Fragment key={item.id}>
                    <View style={styles.timelineRow}>
                      {/* Left time gutter */}
                      <View style={styles.gutter}>
                        <Text style={styles.timeLabel}>{timeLabel}</Text>
                      </View>

                      {/* Right event card */}
                      <View style={styles.timelineContent}>
                        <View style={[styles.eventCard, isOngoing && styles.eventCardOngoing]}>
                          {/* Time range & status tag */}
                          <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardTimeLabel}>{timeRange}</Text>
                            {isOngoing && (
                              <View style={styles.statusPill}>
                                <View style={styles.statusDot} />
                                <Text style={styles.statusText}>Ongoing</Text>
                              </View>
                            )}
                            {isPast && (
                              <View style={styles.pastPill}>
                                <Text style={styles.pastText}>Elapsed</Text>
                              </View>
                            )}
                          </View>

                          {/* Event Title */}
                          <Text style={styles.cardEventTitle} numberOfLines={2}>
                            {item.summary || item.title || 'Focus Session'}
                          </Text>

                          {/* 3 MUTUALLY EXCLUSIVE REMINDER BUTTONS */}
                          {!isPast && (
                            <View style={styles.reminderModeRow}>
                              {/* Alarm Mode */}
                              <TouchableOpacity
                                style={[
                                  styles.reminderModeBtn,
                                  item.reminder_mode === 2 && styles.reminderModeBtnActiveAlarm,
                                ]}
                                onPress={() => handleToggleReminder(item, 2)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.reminderModeText,
                                    item.reminder_mode === 2 && styles.reminderModeTextActiveAlarm,
                                  ]}
                                >
                                  ⏰ Alarm
                                </Text>
                              </TouchableOpacity>

                              {/* Notification Mode */}
                              <TouchableOpacity
                                style={[
                                  styles.reminderModeBtn,
                                  item.reminder_mode === 1 && styles.reminderModeBtnActiveNotif,
                                ]}
                                onPress={() => handleToggleReminder(item, 1)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.reminderModeText,
                                    item.reminder_mode === 1 && styles.reminderModeTextActiveNotif,
                                  ]}
                                >
                                  🔔 Notif
                                </Text>
                              </TouchableOpacity>

                              {/* Off Mode */}
                              <TouchableOpacity
                                style={[
                                  styles.reminderModeBtn,
                                  (item.reminder_mode === 0 || !item.reminder_mode) && styles.reminderModeBtnActiveOff,
                                ]}
                                onPress={() => handleToggleReminder(item, 0)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.reminderModeText,
                                    (item.reminder_mode === 0 || !item.reminder_mode) && styles.reminderModeTextActiveOff,
                                  ]}
                                >
                                  ✕ Off
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* Action Button: Start Focus / Continue */}
                          <View style={styles.cardActionRow}>
                            {!isPast ? (
                              <TouchableOpacity
                                style={[styles.startFocusCardBtn, isOngoing && styles.continueCardBtn]}
                                onPress={() => handleStartFocus(item)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.startFocusCardText}>
                                  {isOngoing ? 'Continue Session' : 'Start Focus'}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={styles.pastNoticeText}>Session concluded</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Current-time marker right after this card if now is between this and next */}
                    {isSelectedDateToday && currentTimeInsertIndex === index + 1 && (
                      <View style={styles.currentTimeRow}>
                        <View style={styles.gutter}>
                          <Text style={styles.currentTimeLabel}>{currentTimeStr}</Text>
                        </View>
                        <View style={styles.currentTimeIndicatorLine}>
                          <View style={styles.currentTimeDot} />
                          <View style={styles.currentLine} />
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                {isSelectedDateToday ? (
                  <>
                    <Text style={styles.emptyTitle}>All caught up for today!</Text>
                    <Text style={styles.emptySubtitle}>
                      {timedEvents.length > 0
                        ? 'Earlier scheduled events have concluded.'
                        : 'No events scheduled for today. Add events in Google Calendar or tap refresh.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>No events on this date</Text>
                    <Text style={styles.emptySubtitle}>No calendar events found for {displayedDateHeading}.</Text>
                  </>
                )}
                <TouchableOpacity style={styles.refreshEmptyBtn} onPress={refreshEvents} activeOpacity={0.8}>
                  <Text style={styles.refreshEmptyBtnText}>Refresh Calendar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5056D8', // Indigo theme
  },
  indigoHeader: {
    backgroundColor: '#5056D8',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    gap: 8,
    marginTop: 4,
  },
  monthText: {
    fontSize: 14,
    color: '#E0E4FF',
    fontWeight: '600',
  },
  weekNavBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  weekNavText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  todayPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoutSmallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoutSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dayColumn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 18,
  },
  dayColumnActive: {
    backgroundColor: '#FFFFFF',
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
    paddingBottom: 110, // Full clearance above bottom navigation
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
  connectLink: {
    backgroundColor: '#EEF1FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  connectLinkText: {
    color: '#5056D8',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    textAlign: 'center',
  },
  allDayContainer: {
    marginBottom: 14,
    backgroundColor: '#F7F8FF',
    borderRadius: 16,
    padding: 12,
  },
  allDaySectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#727A91',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  allDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  allDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5056D8',
    marginRight: 8,
  },
  allDayTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#20283A',
  },
  timelineContainer: {
    marginTop: 4,
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
    fontWeight: '600',
  },
  timelineContent: {
    flex: 1,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5056D8',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  eventCardOngoing: {
    backgroundColor: '#F7F8FF',
    borderLeftColor: '#5056D8',
    borderColor: '#D7DCFF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTimeLabel: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF1FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#5056D8',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5056D8',
  },
  pastPill: {
    backgroundColor: '#F1F3F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pastText: {
    fontSize: 11,
    color: '#8A92A6',
    fontWeight: '600',
  },
  cardEventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 10,
  },
  reminderModeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  reminderModeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1F3F9',
    borderWidth: 1,
    borderColor: '#E2E5F0',
  },
  reminderModeBtnActiveAlarm: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  reminderModeBtnActiveNotif: {
    backgroundColor: '#EEF1FF',
    borderColor: '#5056D8',
  },
  reminderModeBtnActiveOff: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
  },
  reminderModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  reminderModeTextActiveAlarm: {
    color: '#DC2626',
    fontWeight: '700',
  },
  reminderModeTextActiveNotif: {
    color: '#5056D8',
    fontWeight: '700',
  },
  reminderModeTextActiveOff: {
    color: '#374151',
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  startFocusCardBtn: {
    backgroundColor: '#5056D8',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  continueCardBtn: {
    backgroundColor: '#5056D8',
  },
  startFocusCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pastNoticeText: {
    fontSize: 11,
    color: '#8A92A6',
    fontStyle: 'italic',
  },
  currentTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
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
    height: 2,
    backgroundColor: '#5056D8',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#727A91',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  refreshEmptyBtn: {
    backgroundColor: '#5056D8',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  refreshEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
