import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, NativeModules } from 'react-native';
import { FocusStorageService } from '../Services/FocusStorageService';
import { TargetStorageService } from '../Services/TargetStorageService';

const { NativeTracking } = NativeModules;

export function useFocusSession(routeParams = {}) {
    const initialTitle = routeParams.sessionTitle || 'Focus Session';
    const initialDurationMin = routeParams.durationMinutes || 25;
    const initialEventId = routeParams.eventId || null;
    const initialStartTime = routeParams.startTime || null;
    const initialEndTime = routeParams.endTime || null;

    const totalSeconds = initialDurationMin * 60;

    // Session state: 'idle' | 'running' | 'paused' | 'completed' | 'ended_early'
    const [status, setStatus] = useState('idle');
    const [sessionTitle, setSessionTitle] = useState(initialTitle);
    const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
    const [showSummary, setShowSummary] = useState(false);
    const [unlocksCount, setUnlocksCount] = useState(0);
    const [distractingMin, setDistractingMin] = useState(0);

    // References for robust wall-clock timing and idempotency
    const sessionIdRef = useRef(initialEventId ? `session_${initialEventId}` : `session_${Date.now()}`);
    const targetEndTimeRef = useRef(null);
    const sessionStartMsRef = useRef(null);
    const startUnlocksRef = useRef(0);
    const sessionSavedRef = useRef(false);

    // 1. Recover active session from storage on mount (if app was backgrounded/killed)
    useEffect(() => {
        let isMounted = true;

        async function checkSavedSession() {
            const saved = await TargetStorageService.getActiveSession();
            if (!isMounted || !saved) return;

            if (saved.sessionId) sessionIdRef.current = saved.sessionId;
            if (saved.sessionTitle) setSessionTitle(saved.sessionTitle);
            if (saved.sessionStartMs) sessionStartMsRef.current = saved.sessionStartMs;

            if (saved.isPaused) {
                setStatus('paused');
                setSecondsLeft(saved.secondsLeft || 0);
                targetEndTimeRef.current = null;
            } else if (saved.targetEndTimeMs) {
                const now = Date.now();
                const remaining = Math.max(0, Math.round((saved.targetEndTimeMs - now) / 1000));
                if (remaining <= 0) {
                    // Completed while in background!
                    setStatus('completed');
                    setSecondsLeft(0);
                    setShowSummary(true);
                    targetEndTimeRef.current = null;
                } else {
                    setStatus('running');
                    setSecondsLeft(remaining);
                    targetEndTimeRef.current = saved.targetEndTimeMs;
                }
            }
        }

        checkSavedSession();

        return () => {
            isMounted = false;
        };
    }, []);

    // 2. Handle AppState transitions (Background -> Foreground wall-clock sync)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active' && status === 'running' && targetEndTimeRef.current) {
                const now = Date.now();
                const remaining = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000));
                setSecondsLeft(remaining);

                if (remaining <= 0) {
                    setStatus('completed');
                    setShowSummary(true);
                    targetEndTimeRef.current = null;
                    await TargetStorageService.clearActiveSession();
                } else {
                    // Update distraction stats on resume
                    updateDistractions();
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [status]);

    // 3. Countdown interval when running
    useEffect(() => {
        let timer = null;

        if (status === 'running') {
            timer = setInterval(() => {
                if (!targetEndTimeRef.current) return;

                const now = Date.now();
                const remaining = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000));
                setSecondsLeft(remaining);

                if (remaining <= 0) {
                    clearInterval(timer);
                    setStatus('completed');
                    setShowSummary(true);
                    TargetStorageService.clearActiveSession();
                }
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [status]);

    // 4. Update distraction statistics during session
    const updateDistractions = useCallback(async () => {
        if (!sessionStartMsRef.current) return;
        try {
            if (NativeTracking?.getUnlockCountRange) {
                const count = await NativeTracking.getUnlockCountRange(
                    sessionStartMsRef.current,
                    Date.now()
                );
                setUnlocksCount(count || 0);
            }
        } catch (e) {
            // ignore
        }
    }, []);

    // Periodic distraction check every 15s while running
    useEffect(() => {
        let interval = null;
        if (status === 'running') {
            updateDistractions();
            interval = setInterval(updateDistractions, 15000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, updateDistractions]);

    // 5. Actions: Start, Pause, Resume, End Early
    const startSession = async () => {
        const now = Date.now();
        sessionStartMsRef.current = now;
        sessionSavedRef.current = false;
        const targetEnd = now + secondsLeft * 1000;
        targetEndTimeRef.current = targetEnd;

        setStatus('running');

        await TargetStorageService.setActiveSession({
            sessionId: sessionIdRef.current,
            sessionTitle,
            totalSeconds,
            targetEndTimeMs: targetEnd,
            isPaused: false,
            secondsLeft,
            sessionStartMs: now,
        });
    };

    const pauseSession = async () => {
        setStatus('paused');
        targetEndTimeRef.current = null;

        await TargetStorageService.setActiveSession({
            sessionId: sessionIdRef.current,
            sessionTitle,
            totalSeconds,
            targetEndTimeMs: null,
            isPaused: true,
            secondsLeft,
            sessionStartMs: sessionStartMsRef.current,
        });
    };

    const resumeSession = async () => {
        const now = Date.now();
        const targetEnd = now + secondsLeft * 1000;
        targetEndTimeRef.current = targetEnd;

        setStatus('running');

        await TargetStorageService.setActiveSession({
            sessionId: sessionIdRef.current,
            sessionTitle,
            totalSeconds,
            targetEndTimeMs: targetEnd,
            isPaused: false,
            secondsLeft,
            sessionStartMs: sessionStartMsRef.current,
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

    const endSessionEarly = () => {
        setStatus('ended_early');
        targetEndTimeRef.current = null;
        setShowSummary(true);
        TargetStorageService.clearActiveSession();
    };

    // 6. Complete outcome: Save to SQLite exactly once
    const recordOutcome = async (taskCompleted) => {
        if (sessionSavedRef.current) {
            console.log('Session already saved, ignoring redundant recordOutcome call');
            setShowSummary(false);
            return;
        }
        sessionSavedRef.current = true;

        const elapsedSeconds = totalSeconds - secondsLeft;
        const durationMs = Math.max(1000, elapsedSeconds * 1000);
        const startMs = sessionStartMsRef.current || (Date.now() - durationMs);

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
            setSecondsLeft(totalSeconds);
        }
    };

    const elapsedSeconds = totalSeconds - secondsLeft;
    const progressFraction = totalSeconds > 0
        ? Math.max(0, Math.min(1, elapsedSeconds / totalSeconds))
        : 0;

    return {
        status,
        isActive: status === 'running',
        isPaused: status === 'paused',
        isIdle: status === 'idle',
        sessionTitle,
        setSessionTitle,
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
    };
}
