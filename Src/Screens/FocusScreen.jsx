import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Line, Path } from 'react-native-svg';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Routes } from '../Constants/Routes';
import { useFocusSession } from '../Hooks/useFocusSession';
import { FocusStorageService } from '../Services/FocusStorageService';

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;

  const route = useRoute();
  const navigation = useNavigation();

  const {
    status,
    isActive,
    isPaused,
    isIdle,
    sessionTitle,
    secondsLeft,
    totalSeconds,
    elapsedSeconds,
    progressFraction,
    showSummary,
    setShowSummary,
    unlocksCount,
    distractingMin,
    initialDurationMin,
    initialStartTime,
    initialEndTime,
    startSession,
    pauseSession,
    resumeSession,
    togglePlayPause,
    endSessionEarly,
    recordOutcome,
  } = useFocusSession(route.params);

  // Up next event from SQLite
  const [upNextEvent, setUpNextEvent] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadUpNext() {
      try {
        const next = await FocusStorageService.getNextUpcomingEvent();
        if (isMounted) setUpNextEvent(next);
      } catch (e) {
        console.warn('Error fetching up next event:', e);
      }
    }
    loadUpNext();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleEndSession = () => {
    Alert.alert(
      'End Focus Session?',
      'Are you sure you want to conclude this session early?',
      [
        { text: 'Keep Focusing', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: endSessionEarly,
        },
      ]
    );
  };

  // Time calculations
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeString = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Circular ring geometry (radius 95, circumference ~596.9)
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressFraction);

  // Format chip time
  const formattedChipTime = useMemo(() => {
    if (initialStartTime && initialEndTime) {
      const s = new Date(initialStartTime);
      const e = new Date(initialEndTime);
      const formatHM = (d) =>
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return `${formatHM(s)} – ${formatHM(e)}`;
    }
    return `${initialDurationMin} min target`;
  }, [initialStartTime, initialEndTime, initialDurationMin]);

  // Format up next event time
  const upNextTimeFormatted = useMemo(() => {
    if (!upNextEvent) return '';
    const s = new Date(upNextEvent.startTime);
    const e = new Date(upNextEvent.endTime);
    const formatHM = (d) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${formatHM(s)} – ${formatHM(e)}`;
  }, [upNextEvent]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.titleText}>Focus Session</Text>
          <Text style={styles.subtitleText}>Make time for what matters</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            Alert.alert('Session Options', 'Manage focus settings.', [
              { text: 'Switch Session', onPress: () => navigation.navigate(Routes.SCHEDULE) },
              { text: 'Close', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.moreButtonText}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Centered Lavender Session Chip */}
      <View style={styles.sessionChip}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={5} width={18} height={16} rx={3} stroke="#5056D8" strokeWidth={2} />
          <Line x1={3} y1={10} x2={21} y2={10} stroke="#5056D8" strokeWidth={2} />
        </Svg>
        <Text style={styles.sessionChipTitle} numberOfLines={1}>{sessionTitle}</Text>
        <Text style={styles.sessionChipTime}>{formattedChipTime}</Text>
      </View>

      {/* Large Circular Timer Ring */}
      <View style={styles.timerRingSection}>
        <View style={styles.ringContainer}>
          <Svg width={230} height={230} viewBox="0 0 230 230">
            {/* Background Pale Track */}
            <Circle
              cx={115}
              cy={115}
              r={radius}
              stroke="#ECEEF8"
              strokeWidth={10}
              fill="none"
            />
            {/* Active Indigo Ring */}
            <Circle
              cx={115}
              cy={115}
              r={radius}
              stroke="#5056D8"
              strokeWidth={10}
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 115 115)"
            />
          </Svg>

          {/* Centered Overlay */}
          <View style={styles.ringCenterOverlay}>
            <View style={styles.inProgressPill}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isActive
                      ? '#5056D8'
                      : isPaused
                        ? '#EAA128'
                        : '#727A91',
                  },
                ]}
              />
              <Text style={styles.statusPillText}>
                {isActive ? 'In progress' : isPaused ? 'Paused' : 'Ready'}
              </Text>
            </View>
            <Text style={styles.timeValueText}>{timeString}</Text>
            <Text style={styles.remainingLabel}>
              {isIdle ? 'planned' : 'remaining'}
            </Text>
          </View>
        </View>

        <Text style={styles.sessionLengthText}>{initialDurationMin} min session</Text>
      </View>

      {/* Action Controls */}
      <View style={styles.controlsRow}>
        {isIdle ? (
          <TouchableOpacity
            style={styles.startPillBtn}
            onPress={startSession}
            activeOpacity={0.85}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="#FFFFFF">
              <Path d="M5 3L19 12L5 21V3Z" />
            </Svg>
            <Text style={styles.startBtnText}>Start Focus</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.pausePillBtn}
              onPress={togglePlayPause}
              activeOpacity={0.85}
            >
              {isActive ? (
                <View style={styles.pauseIconRow}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="#FFFFFF">
                  <Path d="M5 3L19 12L5 21V3Z" />
                </Svg>
              )}
              <Text style={styles.pauseBtnText}>{isActive ? 'Pause' : 'Resume'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.endPillBtn}
              onPress={endSessionEarly}
              activeOpacity={0.8}
            >
              <View style={styles.stopSquare} />
              <Text style={styles.endBtnText}>End session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* "This session" Card */}
      <View style={styles.thisSessionCard}>
        <Text style={styles.thisSessionTitle}>This session</Text>
        <View style={styles.sessionStatsColumns}>
          <View style={styles.sessionStatCol}>
            <Text style={styles.statLargeNum}>{unlocksCount}</Text>
            <Text style={styles.statSubLabel}>Unlocks</Text>
          </View>
          <View style={styles.sessionDivider} />
          <View style={styles.sessionStatCol}>
            <Text style={styles.statLargeNum}>{distractingMin} min</Text>
            <Text style={styles.statSubLabel}>Distracting apps</Text>
          </View>
        </View>
      </View>

      {/* "Up next" Card */}
      <TouchableOpacity
        style={styles.upNextCard}
        onPress={() => navigation.navigate(Routes.SCHEDULE)}
        activeOpacity={0.8}
      >
        <View style={styles.upNextLeft}>
          <Text style={styles.upNextLabel}>Up next</Text>
          {upNextEvent ? (
            <View style={styles.upNextTitleRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={5} width={18} height={16} rx={3} stroke="#5056D8" strokeWidth={2} />
                <Line x1={3} y1={10} x2={21} y2={10} stroke="#5056D8" strokeWidth={2} />
              </Svg>
              <Text style={styles.upNextTitle} numberOfLines={1}>{upNextEvent.title}</Text>
              <Text style={styles.upNextTime}>{upNextTimeFormatted}</Text>
            </View>
          ) : (
            <Text style={styles.upNextEmpty}>No upcoming events scheduled</Text>
          )}
        </View>
        <Text style={styles.chevronNext}>›</Text>
      </TouchableOpacity>

      {/* Summary Modal with Exactly-Once Outcome Saving */}
      <Modal visible={showSummary} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {status === 'ended_early' ? 'Session Concluded' : 'Session Complete!'}
            </Text>
            <Text style={styles.modalSubtitle}>
              You focused for {Math.max(1, Math.floor(elapsedSeconds / 60))} minutes.
            </Text>
            <Text style={styles.modalQuestion}>Did you complete your planned task?</Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalBtnYes}
                onPress={() => {
                  recordOutcome(true);
                  navigation.navigate(Routes.REPORTS);
                }}
              >
                <Text style={styles.modalBtnTextYes}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnNo}
                onPress={() => {
                  recordOutcome(false);
                  navigation.navigate(Routes.REPORTS);
                }}
              >
                <Text style={styles.modalBtnTextNo}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF', // Pale lavender canvas
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  moreButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEEF5',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    fontSize: 14,
    color: '#20283A',
    fontWeight: '700',
    marginTop: -4,
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
    maxWidth: '90%',
  },
  sessionChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#20283A',
    maxWidth: 160,
  },
  sessionChipTime: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
  },
  timerRingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  ringContainer: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenterOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2FF',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5056D8',
  },
  timeValueText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#20283A',
    letterSpacing: -1,
  },
  remainingLabel: {
    fontSize: 13,
    color: '#727A91',
    fontWeight: '500',
    marginTop: -2,
  },
  sessionLengthText: {
    fontSize: 13,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  startPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5056D8',
    paddingVertical: 14,
    borderRadius: 24,
    gap: 10,
    ...Platform.select({
      android: { elevation: 3 },
      ios: { shadowColor: '#5056D8', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
    }),
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pausePillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5056D8',
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
    ...Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: '#5056D8', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
    }),
  },
  pauseIconRow: {
    flexDirection: 'row',
    gap: 3,
  },
  pauseBar: {
    width: 3.5,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  pauseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  endPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#5056D8',
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
  },
  stopSquare: {
    width: 10,
    height: 10,
    backgroundColor: '#5056D8',
    borderRadius: 2,
  },
  endBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5056D8',
  },
  thisSessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    marginVertical: 6,
  },
  thisSessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
    marginBottom: 10,
  },
  sessionStatsColumns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  sessionDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#ECEEF5',
  },
  statLargeNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#20283A',
  },
  statSubLabel: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 2,
  },
  upNextCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF1FF',
    borderRadius: 20,
    padding: 14,
    marginTop: 4,
  },
  upNextLeft: {
    flex: 1,
  },
  upNextLabel: {
    fontSize: 11,
    color: '#727A91',
    fontWeight: '500',
    marginBottom: 2,
  },
  upNextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upNextTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#20283A',
    maxWidth: 160,
  },
  upNextTime: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
  },
  upNextEmpty: {
    fontSize: 13,
    color: '#727A91',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  chevronNext: {
    fontSize: 18,
    color: '#727A91',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 32, 53, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#727A91',
    marginBottom: 16,
  },
  modalQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#20283A',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtnYes: {
    flex: 1,
    backgroundColor: '#5056D8',
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
  },
  modalBtnTextYes: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnNo: {
    flex: 1,
    backgroundColor: '#F0F2FA',
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
  },
  modalBtnTextNo: {
    color: '#727A91',
    fontSize: 14,
    fontWeight: '700',
  },
});
