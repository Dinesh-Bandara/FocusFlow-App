import { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceEventEmitter, NativeModules } from 'react-native';
import { ensureFocusDbInit } from '../Services/FocusStorageService';
import { TargetStorageService } from '../Services/TargetStorageService';
import { Routes } from '../Constants/Routes';
import { navigate, navigationRef } from '../Navigation/NavigationRef';

const { SplashModule } = NativeModules;

export function useStartup(initialProps = {}) {
  const [startupState, setStartupState] = useState('initializing');
  const [startupError, setStartupError] = useState(null);
  const phaseRef = useRef('initializing');
  const mountedRef = useRef(false);
  const runningRef = useRef(false);
  const lastActionRef = useRef(null);
  // Capture launch props once. Renders must not replay the launch notification.
  const pendingActionRef = useRef(
    initialProps.startupStartFocus
      ? { action: 'START_FOCUS', eventId: initialProps.startupEventId || null }
      : null,
  );

  const onNavigationReady = useCallback(() => {
    if (phaseRef.current !== 'ready' || !navigationRef.isReady()) {
      return;
    }
    // The container can be ready while it still contains the splash route.
    if (!navigationRef.getRootState()?.routes?.some(route => route.name === 'MainTabs')) {
      return;
    }
    const action = pendingActionRef.current;
    if (!action) {
      return;
    }
    const previous = lastActionRef.current;
    const now = Date.now();
    if (previous?.eventId === action.eventId && now - previous.at < 1500) {
      return;
    }
    lastActionRef.current = { eventId: action.eventId, at: now };
    pendingActionRef.current = null;

    const doNavigate = () => {
      try {
        navigate('MainTabs', {
          screen: Routes.FOCUS,
          params: action.eventId ? { eventId: action.eventId } : {},
        });
        navigate(Routes.FOCUS, action.eventId ? { eventId: action.eventId } : {});
      } catch (e) {
        console.warn('Navigation error:', e);
      }
    };

    doNavigate();
    setTimeout(doNavigate, 200);
  }, []);

  const runStartup = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    phaseRef.current = 'initializing';
    setStartupState('initializing');
    setStartupError(null);
    try {
      // Only local work needed to choose the initial screen blocks startup.
      // Calendar sync and screen-specific data loading belong to their screens.
      const actionAtStart = pendingActionRef.current;
      const nativeActionTask = SplashModule?.getPendingAction
        ? SplashModule.getPendingAction().then(action => {
            if (
              action?.action === 'START_FOCUS' &&
              pendingActionRef.current === actionAtStart
            ) {
              pendingActionRef.current = {
                action: 'START_FOCUS',
                eventId: action.eventId || null,
              };
            }
          }).catch(error => console.warn('Launch action unavailable:', error))
        : Promise.resolve();
      const [, activeSession] = await Promise.all([
        ensureFocusDbInit(),
        TargetStorageService.getActiveSession(),
        nativeActionTask,
      ]);
      if (!mountedRef.current) {
        return;
      }
      if (
        !pendingActionRef.current &&
        activeSession &&
        !activeSession.isPaused &&
        activeSession.targetEndTimeMs > Date.now()
      ) {
        pendingActionRef.current = { action: 'START_FOCUS', eventId: null };
      }
      phaseRef.current = 'ready';
      setStartupState('ready');
      // AppNavigator flushes the queued destination after MainTabs is registered.
    } catch (error) {
      if (mountedRef.current) {
        phaseRef.current = 'error';
        setStartupError(error);
        setStartupState('error');
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const subscription = DeviceEventEmitter.addListener('onFocusAlarmAction', action => {
      if (!action || (action.action && action.action !== 'START_FOCUS')) {
        return;
      }
      pendingActionRef.current = {
        action: 'START_FOCUS',
        eventId: action.eventId || null,
      };
      onNavigationReady();
    });
    runStartup();
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [runStartup, onNavigationReady]);

  return {
    startupState,
    startupError,
    retry: runStartup,
    onNavigationReady,
    isReady: startupState === 'ready',
    isError: startupState === 'error',
    isInitializing: startupState === 'initializing',
  };
}
