import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  StatusBar,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Line, Path } from 'react-native-svg';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Routes } from '../Constants/Routes';
import { useFocusSession } from '../Hooks/useFocusSession';
import { FocusStorageService } from '../Services/FocusStorageService';
import { TargetStorageService } from '../Services/TargetStorageService';

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 10;

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
    recordedFocusSeconds,
    plannedMinutes,
    progressFraction,
    showSummary,
    setShowSummary,
    unlocksCount,
    distractingMin,
    distractingBreakdown,
    initialStartTime,
    initialEndTime,
    startSession,
    pauseSession,
    resumeSession,
    togglePlayPause,
    endSessionEarly,
    recordOutcome,
    refreshMetrics,
  } = useFocusSession(route.params);

  // Up next event from SQLite
  const [upNextEvent, setUpNextEvent] = useState(null);

  // Distracting Apps Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [distractingList, setDistractingList] = useState([]);
  const [newPackageInput, setNewPackageInput] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const next = await FocusStorageService.getNextUpcomingEvent();
        if (isMounted) setUpNextEvent(next);

        const apps = await TargetStorageService.getDistractingApps();
        if (isMounted) setDistractingList(apps);
      } catch (e) {
        console.warn('Error fetching focus screen data:', e);
      }
    }
    loadData();
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

  const handleToggleDistractingPackage = async (pkg) => {
    let updated;
    if (distractingList.includes(pkg)) {
      updated = distractingList.filter(p => p !== pkg);
    } else {
      updated = [...distractingList, pkg];
    }
    setDistractingList(updated);
    await TargetStorageService.setDistractingApps(updated);
    refreshMetrics();
  };

  const handleAddCustomPackage = async () => {
    const trimmed = newPackageInput.trim();
    if (!trimmed) return;
    if (!distractingList.includes(trimmed)) {
      const updated = [...distractingList, trimmed];
      setDistractingList(updated);
      await TargetStorageService.setDistractingApps(updated);
      refreshMetrics();
    }
    setNewPackageInput('');
  };

  // Time calculations
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeString = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Recorded focus time in MM:SS
  const recordedMin = Math.floor(recordedFocusSeconds / 60);
  const recordedSec = recordedFocusSeconds % 60;
  const recordedTimeString = `${recordedMin < 10 ? '0' : ''}${recordedMin}:${recordedSec < 10 ? '0' : ''}${recordedSec}`;

  // Circular ring geometry (radius 95, circumference ~596.9)
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressFraction);

  // Format chip time
  const formattedChipTime = useMemo(() => {
    if (initialStartTime && initialEndTime) {
      const s = new Date(initialStartTime);
      const e = new Date(initialEndTime);
      const formatHM = d =>
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return `${formatHM(s)} – ${formatHM(e)} (${plannedMinutes}m slot)`;
    }
    return `${plannedMinutes} min target`;
  }, [initialStartTime, initialEndTime, plannedMinutes]);

  // Format slot end time for helper note
  const slotEndTimeFormatted = useMemo(() => {
    if (initialEndTime) {
      const e = new Date(initialEndTime);
      return `${e.getHours().toString().padStart(2, '0')}:${e.getMinutes().toString().padStart(2, '0')}`;
    }
    return null;
  }, [initialEndTime]);

  // Format up next event time
  const upNextTimeFormatted = useMemo(() => {
    if (!upNextEvent) return '';
    const s = new Date(upNextEvent.startTime);
    const e = new Date(upNextEvent.endTime);
    const formatHM = d =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${formatHM(s)} – ${formatHM(e)}`;
  }, [upNextEvent]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FF" translucent={true} />

      {/* 1. STATIONARY FIXED HEADER */}
      <View style={styles.fixedHeader}>
        <View>
          <Text style={styles.titleText}>Focus Session</Text>
          <Text style={styles.subtitleText}>Make time for what matters</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            Alert.alert('Session Options', 'Manage focus settings.', [
              { text: 'Configure Distracting Apps', onPress: () => setShowConfigModal(true) },
              { text: 'Switch Session in Schedule', onPress: () => navigation.navigate(Routes.SCHEDULE) },
              { text: 'Close', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.moreButtonText}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* 2. SCROLLABLE BODY CONTENT */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Centered Lavender Session Chip */}
        <View style={styles.sessionChip}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={5} width={18} height={16} rx={3} stroke="#5056D8" strokeWidth={2} />
            <Line x1={3} y1={10} x2={21} y2={10} stroke="#5056D8" strokeWidth={2} />
          </Svg>
          <Text style={styles.sessionChipTitle} numberOfLines={1}>
            {sessionTitle}
          </Text>
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
                {isIdle ? 'slot duration' : 'slot remaining'}
              </Text>
            </View>
          </View>

          {/* Sub-label describing recorded focus time vs calendar end boundary */}
          {slotEndTimeFormatted ? (
            <View style={styles.slotDetailsBox}>
              <Text style={styles.slotDetailText}>
                {isPaused
                  ? `Paused • Slot ends at ${slotEndTimeFormatted}`
                  : `Focus slot ends at ${slotEndTimeFormatted}`}
              </Text>
              <Text style={styles.recordedFocusText}>
                Recorded focus: {recordedTimeString}
              </Text>
            </View>
          ) : (
            <Text style={styles.sessionLengthText}>{plannedMinutes} min session</Text>
          )}
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
                onPress={handleEndSession}
                activeOpacity={0.8}
              >
                <View style={styles.stopSquare} />
                <Text style={styles.endBtnText}>End session</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* "This session" Card (Strictly Session-Specific Metrics) */}
        <View style={styles.thisSessionCard}>
          <View style={styles.thisSessionHeaderRow}>
            <Text style={styles.thisSessionTitle}>This session metrics</Text>
            <TouchableOpacity onPress={() => setShowConfigModal(true)} style={styles.configBtn} activeOpacity={0.7}>
              <Text style={styles.configBtnText}>⚙ Choose apps</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sessionStatsColumns}>
            <View style={styles.sessionStatCol}>
              <Text style={styles.statLargeNum}>{unlocksCount}</Text>
              <Text style={styles.statSubLabel}>Controlled unlocks</Text>
            </View>
            <View style={styles.sessionDivider} />
            <View style={styles.sessionStatCol}>
              <Text style={styles.statLargeNum}>
                {distractingMin > 0 ? `${distractingMin} min` : (distractingBreakdown.length > 0 ? '<1m' : '0 min')}
              </Text>
              <Text style={styles.statSubLabel}>Distracting apps</Text>
            </View>
          </View>

          {/* Per-app breakdown during active focus intervals */}
          {distractingBreakdown.length > 0 && (
            <View style={styles.breakdownContainer}>
              <Text style={styles.breakdownHeader}>Session Distractions:</Text>
              {distractingBreakdown.map(item => (
                <View key={item.packageName} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    {item.icon ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${item.icon}` }}
                        style={styles.breakdownAppIcon}
                      />
                    ) : (
                      <View style={styles.breakdownDot} />
                    )}
                    <Text style={styles.breakdownAppName} numberOfLines={1}>
                      {item.appName}
                    </Text>
                  </View>
                  <Text style={styles.breakdownAppDuration}>{item.formattedDuration}</Text>
                </View>
              ))}
            </View>
          )}
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
                <Text style={styles.upNextTitle} numberOfLines={1}>
                  {upNextEvent.title}
                </Text>
                <Text style={styles.upNextTime}>{upNextTimeFormatted}</Text>
              </View>
            ) : (
              <Text style={styles.upNextEmpty}>No upcoming events scheduled</Text>
            )}
          </View>
          <Text style={styles.chevronNext}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 3. Summary Modal with Exactly-Once Outcome Saving */}
      <Modal visible={showSummary} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {status === 'ended_early' ? 'Session Concluded' : 'Session Complete!'}
            </Text>
            <Text style={styles.modalSubtitle}>
              You focused for {Math.max(1, Math.round(recordedFocusSeconds / 60))} minutes on "{sessionTitle}".
            </Text>

            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatNum}>{unlocksCount}</Text>
                <Text style={styles.summaryStatLabel}>Unlocks</Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatNum}>
                  {distractingMin > 0 ? `${distractingMin}m` : (distractingBreakdown.length > 0 ? '<1m' : '0m')}
                </Text>
                <Text style={styles.summaryStatLabel}>Distractions</Text>
              </View>
            </View>

            <Text style={styles.modalQuestion}>Did you complete your goal?</Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => recordOutcome(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSecondaryBtnText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => recordOutcome(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>Yes, Completed!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Distracting Apps Configuration Modal */}
      <Modal visible={showConfigModal} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.configModalCard}>
            <Text style={styles.configModalTitle}>Distracting Apps</Text>
            <Text style={styles.configModalSubtitle}>
              Select which apps are tracked as distractions during active focus intervals.
            </Text>

            <ScrollView style={styles.configList} showsVerticalScrollIndicator={false}>
              {distractingList.map(pkg => (
                <View key={pkg} style={styles.configAppRow}>
                  <Text style={styles.configAppPkg} numberOfLines={1}>
                    {pkg.split('.').pop()?.toUpperCase()} ({pkg})
                  </Text>
                  <TouchableOpacity
                    style={styles.removeAppBtn}
                    onPress={() => handleToggleDistractingPackage(pkg)}
                  >
                    <Text style={styles.removeAppBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.addAppRow}>
              <TextInput
                style={styles.addAppInput}
                placeholder="package.name (e.g. com.example)"
                placeholderTextColor="#9CA3AF"
                value={newPackageInput}
                onChangeText={setNewPackageInput}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addAppBtn} onPress={handleAddCustomPackage}>
                <Text style={styles.addAppBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeConfigBtn}
              onPress={() => setShowConfigModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeConfigBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF',
  },
  fixedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#F7F8FF',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#20283A',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 13,
    color: '#727A91',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    borderRadius: 20,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#727A91',
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110, // Generous clearance above bottom navigation
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECEEF8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    gap: 8,
    maxWidth: '90%',
    marginBottom: 20,
  },
  sessionChipTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#20283A',
    flexShrink: 1,
  },
  sessionChipTime: {
    fontSize: 12,
    color: '#5056D8',
    fontWeight: '600',
  },
  timerRingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ringContainer: {
    width: 230,
    height: 230,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCenterOverlay: {
    position: 'absolute',
    alignItems: 'center',
  },
  inProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECEEF8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    color: '#20283A',
    fontWeight: '600',
  },
  timeValueText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#20283A',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  remainingLabel: {
    fontSize: 13,
    color: '#727A91',
    fontWeight: '500',
    marginTop: -2,
  },
  slotDetailsBox: {
    alignItems: 'center',
    marginTop: 10,
  },
  slotDetailText: {
    fontSize: 13,
    color: '#5056D8',
    fontWeight: '600',
  },
  recordedFocusText: {
    fontSize: 12,
    color: '#727A91',
    marginTop: 2,
  },
  sessionLengthText: {
    fontSize: 13,
    color: '#727A91',
    fontWeight: '500',
    marginTop: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  startPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5056D8',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    gap: 10,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pausePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5056D8',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    gap: 8,
  },
  pauseIconRow: {
    flexDirection: 'row',
    gap: 3,
  },
  pauseBar: {
    width: 3,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  pauseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  endPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  stopSquare: {
    width: 10,
    height: 10,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  endBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
  },
  thisSessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  thisSessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  thisSessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#20283A',
  },
  configBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF1FF',
  },
  configBtnText: {
    fontSize: 11,
    color: '#5056D8',
    fontWeight: '600',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 2,
  },
  statSubLabel: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
  },
  breakdownContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F9',
  },
  breakdownHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#727A91',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  breakdownAppIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  breakdownAppName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#20283A',
    flexShrink: 1,
  },
  breakdownAppDuration: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  upNextLeft: {
    flex: 1,
    marginRight: 10,
  },
  upNextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#727A91',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  upNextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upNextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
    flexShrink: 1,
  },
  upNextTime: {
    fontSize: 12,
    color: '#727A91',
    fontWeight: '500',
  },
  upNextEmpty: {
    fontSize: 13,
    color: '#727A91',
    fontStyle: 'italic',
  },
  chevronNext: {
    fontSize: 20,
    color: '#727A91',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 40, 58, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
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
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F8FF',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5056D8',
  },
  summaryStatLabel: {
    fontSize: 11,
    color: '#727A91',
    marginTop: 2,
  },
  modalQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
    marginBottom: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#ECEEF8',
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20283A',
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#5056D8',
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  configModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  configModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#20283A',
    marginBottom: 4,
  },
  configModalSubtitle: {
    fontSize: 12,
    color: '#727A91',
    marginBottom: 14,
  },
  configList: {
    maxHeight: 250,
    marginBottom: 14,
  },
  configAppRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F9',
  },
  configAppPkg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#20283A',
    flex: 1,
    marginRight: 8,
  },
  removeAppBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  removeAppBtnText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '600',
  },
  addAppRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addAppInput: {
    flex: 1,
    backgroundColor: '#F7F8FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#20283A',
    borderWidth: 1,
    borderColor: '#ECEEF5',
  },
  addAppBtn: {
    backgroundColor: '#5056D8',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addAppBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeConfigBtn: {
    backgroundColor: '#5056D8',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeConfigBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
