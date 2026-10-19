import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { GoogleAuthService } from '../Services/Google/GoogleAuthService';
import { CalendarApiService } from '../Services/Google/CalendarApiService';
import { ReminderService } from '../Services/ReminderService';

export const useCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const checkCurrentUser = useCallback(async () => {
    try {
      const user = await GoogleAuthService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        await fetchEvents();
      } else {
        // Even without signed-in user, load any cached events from SQLite
        await loadCachedEvents();
      }
    } catch (e) {
      console.warn('Error checking user:', e);
      await loadCachedEvents();
    }
  }, []);

  useEffect(() => {
    checkCurrentUser();

    // Refresh when app returns to foreground
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        GoogleAuthService.getCurrentUser().then(u => {
          if (u) fetchEvents(false);
        }).catch(() => {});
      }
    });

    return () => {
      sub.remove();
    };
  }, [checkCurrentUser]);

  const loadCachedEvents = async () => {
    try {
      const now = Date.now();
      const startMs = now - 14 * 86400000;
      const endMs = now + 30 * 86400000;
      const cached = await ReminderService.getEventsForDateRange(startMs, endMs);
      const lastSync = await ReminderService.getLastSyncTime();
      setLastSyncTime(lastSync);

      const mapped = cached.map(c => ({
        id: c.id,
        summary: c.title,
        title: c.title,
        start: { dateTime: c.is_all_day ? null : new Date(c.start_time).toISOString(), date: c.is_all_day ? new Date(c.start_time).toISOString().slice(0, 10) : null },
        end: { dateTime: c.is_all_day ? null : new Date(c.end_time).toISOString(), date: c.is_all_day ? new Date(c.end_time).toISOString().slice(0, 10) : null },
        startTimeMs: c.start_time,
        endTimeMs: c.end_time,
        isAllDay: c.is_all_day === 1,
        reminder_mode: c.reminder_mode || 0,
        offset_min: c.offset_min || 0,
      }));
      setEvents(mapped);
    } catch (e) {
      console.warn('Error loading cached events:', e);
    }
  };

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await GoogleAuthService.signIn();
      if (result && result.userInfo) {
        setCurrentUser(result.userInfo);
        await fetchEvents(true);
      } else {
        setError('Google sign-in was cancelled or unavailable.');
      }
    } catch (e) {
      setError(e.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await GoogleAuthService.signOut();
    setCurrentUser(null);
    // Keep local cache or clear as needed
  };

  const fetchEvents = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const token = await GoogleAuthService.getTokens();
      if (token) {
        const fetched = await CalendarApiService.fetchUpcomingEvents(token);
        await ReminderService.syncEvents(fetched);
        await loadCachedEvents();
      } else {
        await loadCachedEvents();
      }
    } catch (err) {
      console.warn('Calendar sync warning:', err);
      setError(err.message || 'Unable to sync with Google Calendar.');
      // Fallback to local SQLite cache
      await loadCachedEvents();
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  return {
    events,
    loading,
    error,
    currentUser,
    lastSyncTime,
    login,
    logout,
    refreshEvents: () => fetchEvents(true),
    loadCachedEvents,
  };
};
