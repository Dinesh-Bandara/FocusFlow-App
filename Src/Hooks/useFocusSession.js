import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Alert, NativeModules } from 'react-native';
import { FocusStorageService } from '../Services/FocusStorageService';
import { TargetStorageService } from '../Services/TargetStorageService';
import SQLite from 'react-native-sqlite-storage';

const { NativeTracking } = NativeModules;
const db = SQLite.openDatabase({ name: 'focusflow.db', location: 'default' });

// Format milliseconds into "5m", "1h 8m", "<1m"
export function formatUsageDuration(ms) {
  if (!ms || ms < 60000) return '<1m';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

export function useFocusSession(routeParams = {}) {
  const initialTitle = routeParams.sessionTitle || 'Focus Session';
  const initialDurationMin = routeParams.durationMinutes || 25;
  const initialEventId = routeParams.eventId || null;
  const initialStartTime = routeParams.startTime || null;
  const initialEndTime = routeParams.endTime || null;

  // Session state: 'idle' | 'running' | 'paused' | 'completed' | 'ended_early'
  const [status, setStatus] = useState('idle');
  const [sessionTitle, setSessionTitle] = useState(initialTitle);
  const [eventId, setEventId] = useState(initialEventId);
  const [slotStartTime, setSlotStartTime] = useState(initialStartTime);
  const [slotEndTime, setSlotEndTime] = useState(initialEndTime);

  // Planned slot duration vs remaining slot time vs recorded focus time
  const [plannedMinutes, setPlannedMinutes] = useState(initialDurationMin);
  const [secondsLeft, setSecondsLeft] = useState(initialDurationMin * 60);
  const [recordedFocusSeconds, setRecordedFocusSeconds] = useState(0);

  // Distraction & Unlock metrics
  const [unlocksCount, setUnlocksCount] = useState(0);
  const [distractingMin, setDistractingMin] = useState(0);
  const [distractingBreakdown, setDistractingBreakdown] = useState([]);
  const [showSummary, setShowSummary] = useState(false);

  // References for timing & intervals
  const sessionIdRef = useRef(initialEventId ? `session_${initialEventId}` : `session_${Date.now()}`);
  const activeIntervalsRef = useRef([]); // [ { start: ms, end: ms } ]
  const currentIntervalStartRef = useRef(null);
  const sessionSavedRef = useRef(false);
  const isCalendarLinkedRef = useRef(!!initialEndTime);

  // 1. Initial configuration: calculate real remaining slot duration if calendar-linked
  useEffect(() => {
    if (initialEndTime && initialStartTime) {
      isCalendarLinkedRef.current = true;
      const planned = Math.max(1, Math.round((initialEndTime - initialStartTime) / 60000));
      setPlannedMinutes(planned);

      const now = Date.now();
      const remainingSec = Math.max(0, Math.round((initialEndTime - now) / 1000));
      setSecondsLeft(remainingSec);
      setSlotStartTime(initialStartTime);
      setSlotEndTime(initialEndTime);
      setSessionTitle(initialTitle);
      setEventId(initialEventId);
    } else if (initialEventId && !initialEndTime) {
      // Query SQLite calendar_events table if only eventId was provided
      db.transaction(tx => {
        tx.executeSql(
          'SELECT title, start_time, end_time FROM calendar_events WHERE id = ?',
          [initialEventId],
          (t, results) => {
            if (results.rows.length > 0) {
              const row = results.rows.item(0);
              const s = row.start_time;
              const e = row.end_time;
              const planned = Math.max(1, Math.round((e - s) / 60000));
              const now = Date.now();
              const remainingSec = Math.max(0, Math.round((e - now) / 1000));

              isCalendarLinkedRef.current = true;
              setSessionTitle(row.title || initialTitle);
              setPlannedMinutes(planned);
              setSecondsLeft(remainingSec);
              setSlotStartTime(s);
              setSlotEndTime(e);
            }
          }
        );
      });
    }
  }, [initialEventId, initialStartTime, initialEndTime, initialTitle]);

  // 2. Recover active session from storage & prompt if switching different session
  useEffect(() => {
    let isMounted = true;

    async function checkSavedSession() {
      const saved = await TargetStorageService.getActiveSession();
      if (!isMounted || !saved) return;

      const incomingId = initialEventId ? `session_${initialEventId}` : null;

      // If incoming session is different from existing running session, ask user
      if (incomingId && saved.sessionId && incomingId !== saved.sessionId && saved.status === 'running') {
        Alert.alert(
          'Session in Progress',
          `You have an active session "${saved.sessionTitle}". Do you want to conclude it and switch to "${initialTitle}"?`,
          [
            {
              text: 'Keep Current',
              onPress: () => {
                // Restore current running session
                restoreSavedSession(saved);
              },
            },
            {
              text: 'Switch Session',
              style: 'destructive',
              onPress: async () => {
                await TargetStorageService.clearActiveSession();
                // Start fresh with incoming session
              },
            },
          ]
        );
        return;
      }

      restoreSavedSession(saved);
    }

    function restoreSavedSession(saved) {
      if (!isMounted) return;
      sessionIdRef.current = saved.sessionId;
      if (saved.sessionTitle) setSessionTitle(saved.sessionTitle);
      if (saved.plannedMinutes) setPlannedMinutes(saved.plannedMinutes);
      if (saved.slotStartTime) setSlotStartTime(saved.slotStartTime);
      if (saved.slotEndTime) {
        setSlotEndTime(saved.slotEndTime);
        isCalendarLinkedRef.current = true;
      }
      if (saved.activeIntervals) activeIntervalsRef.current = saved.activeIntervals;
      if (saved.recordedFocusSeconds) setRecordedFocusSeconds(saved.recordedFocusSeconds);

      const now = Date.now();
      if (saved.status === 'paused') {
        setStatus('paused');
        setSecondsLeft(saved.secondsLeft || 0);
      } else if (saved.status === 'running') {
        let remaining = saved.secondsLeft;
        if (saved.slotEndTime) {
          remaining = Math.max(0, Math.round((saved.slotEndTime - now) / 1000));
        }

        if (remaining <= 0) {
          // Completed while app was closed/backgrounded
          setStatus('completed');
          setSecondsLeft(0);
          setShowSummary(true);
        } else {
          setStatus('running');
          setSecondsLeft(remaining);
          currentIntervalStartRef.current = saved.lastResumedAtMs || now;
        }
      }
    }

    checkSavedSession();

    return () => {
      isMounted = false;
    };
  }, [initialEventId, initialTitle]);

  // 3. Periodic metric measurement (unlocks & distracting apps across active intervals)
  const refreshMetrics = useCallback(async () => {
    try {
      // Build full list of intervals including currently running interval
      const intervals = [...activeIntervalsRef.current];
      if (currentIntervalStartRef.current && status === 'running') {
        intervals.push({ start: currentIntervalStartRef.current, end: Date.now() });
      }

      if (intervals.length === 0) return;

      // 1. Measure unlocks strictly within active intervals
      let totalUnlocks = 0;
      if (NativeTracking?.getUnlockCountRange) {
        for (const interval of intervals) {
          if (interval.end > interval.start) {
            const count = await NativeTracking.getUnlockCountRange(interval.start, interval.end);
            totalUnlocks += (count || 0);
          }
        }
      }
      setUnlocksCount(totalUnlocks);

      // 2. Measure distracting app usage strictly within active intervals
      const userDistractingList = await TargetStorageService.getDistractingApps();
      const distractingSet = new Set(userDistractingList);
      const appUsageAccumulator = {}; // { [pkg]: totalMs }

      if (NativeTracking?.getUsageRange) {
        for (const interval of intervals) {
          if (interval.end > interval.start) {
            const usageMap = await NativeTracking.getUsageRange(interval.start, interval.end);
            if (usageMap) {
              for (const [pkg, durationMs] of Object.entries(usageMap)) {
                if (distractingSet.has(pkg) && durationMs > 0) {
                  appUsageAccumulator[pkg] = (appUsageAccumulator[pkg] || 0) + durationMs;
                }
              }
            }
          }
        }
      }

      let totalDistractingMs = 0;
      const packagesWithUsage = Object.keys(appUsageAccumulator);

      for (const pkg of packagesWithUsage) {
        totalDistractingMs += appUsageAccumulator[pkg];
      }

      const totalDistractingMin = Math.round(totalDistractingMs / 60000);
      setDistractingMin(totalDistractingMin);

      // Retrieve real app metadata (app label & icon)
      if (packagesWithUsage.length > 0 && NativeTracking?.getAppsMetadata) {
        try {
          const metaMap = await NativeTracking.getAppsMetadata(packagesWithUsage);
          const breakdown = packagesWithUsage.map(pkg => ({
            packageName: pkg,
            appName: metaMap?.[pkg]?.appName || pkg.split('.').pop(),
            icon: metaMap?.[pkg]?.icon || null,
            durationMs: appUsageAccumulator[pkg],
            formattedDuration: formatUsageDuration(appUsageAccumulator[pkg]),
          }));
          breakdown.sort((a, b) => b.durationMs - a.durationMs);
          setDistractingBreakdown(breakdown);
        } catch (e) {
          console.warn('Error fetching apps metadata:', e);
        }
      } else {
        setDistractingBreakdown([]);
      }
    } catch (e) {
      console.warn('Error refreshing session metrics:', e);
    }
  }, [status]);

  // AppState change: foreground return syncs clock & metrics immediately
  useEffect(() => {
    const sub = AppState.addEventListener('change', async nextState => {
      if (nextState === 'active' && status === 'running') {
        const now = Date.now();
        if (slotEndTime) {
          const rem = Math.max(0, Math.round((slotEndTime - now) / 1000));
          setSecondsLeft(rem);
          if (rem <= 0) {
            handleCompleteSession();
            return;
          }
        }
        refreshMetrics();
      }
    });

    return () => {
      sub.remove();
    };
  }, [status, slotEndTime, refreshMetrics]);

  // Timer interval: 1-second ticks while running
  useEffect(() => {
    let timer = null;

    if (status === 'running') {
      timer = setInterval(() => {
        setRecordedFocusSeconds(prev => prev + 1);

        if (slotEndTime) {
          // Calendar-linked: derive remaining slot time from timestamps!
          const now = Date.now();
          const rem = Math.max(0, Math.round((slotEndTime - now) / 1000));
          setSecondsLeft(rem);

          if (rem <= 0) {
            clearInterval(timer);
            handleCompleteSession();
          }
        } else {
          // Non-calendar countdown
          setSecondsLeft(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              handleCompleteSession();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status, slotEndTime]);

  // Periodic metrics refresh every 15s while running
  useEffect(() => {
    let interval = null;
    if (status === 'running') {
      refreshMetrics();
      interval = setInterval(refreshMetrics, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, refreshMetrics]);

  // Actions: Start, Pause, Resume, End Early, Complete
  const startSession = async () => {
    const now = Date.now();
    currentIntervalStartRef.current = now;
    sessionSavedRef.current = false;

    let initialSecLeft = secondsLeft;
    if (slotEndTime) {
      initialSecLeft = Math.max(0, Math.round((slotEndTime - now) / 1000));
      setSecondsLeft(initialSecLeft);
    }

    setStatus('running');

    await TargetStorageService.setActiveSession({
      sessionId: sessionIdRef.current,
      eventId,
      sessionTitle,
      plannedMinutes,
      slotStartTime,
      slotEndTime,
      status: 'running',
      secondsLeft: initialSecLeft,
      lastResumedAtMs: now,
      recordedFocusSeconds,
      activeIntervals: activeIntervalsRef.current,
    });
  };

  const pauseSession = async () => {
    const now = Date.now();
    if (currentIntervalStartRef.current) {
      activeIntervalsRef.current.push({
        start: currentIntervalStartRef.current,
        end: now,
      });
      currentIntervalStartRef.current = null;
    }

    setStatus('paused');

    await TargetStorageService.setActiveSession({
      sessionId: sessionIdRef.current,
      eventId,
      sessionTitle,
      plannedMinutes,
      slotStartTime,
      slotEndTime,
      status: 'paused',
      secondsLeft,
      lastResumedAtMs: null,
      recordedFocusSeconds,
      activeIntervals: activeIntervalsRef.current,
    });

    refreshMetrics();
  };

  const resumeSession = async () => {
    const now = Date.now();
    currentIntervalStartRef.current = now;

    let currentSecLeft = secondsLeft;
    if (slotEndTime) {
      currentSecLeft = Math.max(0, Math.round((slotEndTime - now) / 1000));
      setSecondsLeft(currentSecLeft);
    }

    setStatus('running');

    await TargetStorageService.setActiveSession({
      sessionId: sessionIdRef.current,
      eventId,
      sessionTitle,
      plannedMinutes,
      slotStartTime,
      slotEndTime,
      status: 'running',
      secondsLeft: currentSecLeft,
      lastResumedAtMs: now,
      recordedFocusSeconds,
      activeIntervals: activeIntervalsRef.current,
    });
  };

  const togglePlayPause = () => {
    if (status === 'idle') {
      startSession();
    } else if (status === 'running') {
      pauseSession();
    } else if (status === 'paused') {
      resumeSession();
    }
  };

  const handleCompleteSession = async () => {
    const now = Date.now();
    if (currentIntervalStartRef.current) {
      activeIntervalsRef.current.push({
        start: currentIntervalStartRef.current,
        end: now,
      });
      currentIntervalStartRef.current = null;
    }
    setStatus('completed');
    setShowSummary(true);
    await TargetStorageService.clearActiveSession();
    refreshMetrics();
  };

  const endSessionEarly = async () => {
    const now = Date.now();
    if (currentIntervalStartRef.current) {
      activeIntervalsRef.current.push({
        start: currentIntervalStartRef.current,
        end: now,
      });
      currentIntervalStartRef.current = null;
    }
    setStatus('ended_early');
    setShowSummary(true);
    await TargetStorageService.clearActiveSession();
    refreshMetrics();
  };

  // 4. Save completed or ended session to SQLite exactly once
  const recordOutcome = async (taskCompleted) => {
    if (sessionSavedRef.current) {
      setShowSummary(false);
      return;
    }
    sessionSavedRef.current = true;

    const durationMs = Math.max(1000, recordedFocusSeconds * 1000);
    const startMs = slotStartTime || (Date.now() - durationMs);

    try {
      await FocusStorageService.saveFocusSession({
        sessionId: sessionIdRef.current,
        startTime: startMs,
        durationMs,
        status: status === 'ended_early' ? 'ended_early' : 'completed',
        sessionTitle,
        taskCompleted: taskCompleted ? 1 : 0,
      });
    } catch (e) {
      console.error('Failed to save focus session outcome:', e);
    } finally {
      await TargetStorageService.clearActiveSession();
      setShowSummary(false);
      setStatus('idle');
      activeIntervalsRef.current = [];
      currentIntervalStartRef.current = null;
    }
  };

  const totalSlotSeconds = plannedMinutes * 60;
  const progressFraction = totalSlotSeconds > 0
    ? Math.max(0, Math.min(1, (totalSlotSeconds - secondsLeft) / totalSlotSeconds))
    : 0;

  return {
    status,
    isActive: status === 'running',
    isPaused: status === 'paused',
    isIdle: status === 'idle',
    sessionTitle,
    setSessionTitle,
    secondsLeft,
    totalSeconds: totalSlotSeconds,
    recordedFocusSeconds,
    plannedMinutes,
    progressFraction,
    showSummary,
    setShowSummary,
    unlocksCount,
    distractingMin,
    distractingBreakdown,
    initialDurationMin: plannedMinutes,
    initialStartTime: slotStartTime,
    initialEndTime: slotEndTime,
    startSession,
    pauseSession,
    resumeSession,
    togglePlayPause,
    endSessionEarly,
    recordOutcome,
    refreshMetrics,
  };
}
