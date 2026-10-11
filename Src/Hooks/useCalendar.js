import { useState, useEffect } from 'react';
import { GoogleAuthService } from '../Services/Google/GoogleAuthService';
import { CalendarApiService } from '../Services/Google/CalendarApiService';
import { ReminderService } from '../Services/ReminderService';

export const useCalendar = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        checkCurrentUser();
    }, []);

    const checkCurrentUser = async () => {
        const user = await GoogleAuthService.getCurrentUser();
        if (user) {
            setCurrentUser(user);
            fetchEvents();
        }
    };

    const login = async () => {
        setLoading(true);
        setError(null);
        const result = await GoogleAuthService.signIn();
        if (result && result.userInfo) {
            setCurrentUser(result.userInfo);
            await fetchEvents();
        } else {
            setError("Failed to sign in. Check Play Services or credentials.");
        }
        setLoading(false);
    };

    const logout = async () => {
        await GoogleAuthService.signOut();
        setCurrentUser(null);
        setEvents([]);
    };

    const fetchEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await GoogleAuthService.getTokens();
            if (token) {
                const upcoming = await CalendarApiService.fetchUpcomingEvents(token);
                // Synchronize raw events to local SQLite db and compute Native Alarms
                await ReminderService.syncEvents(upcoming);

                // Read local preferences back
                const prefs = await ReminderService.getRemindersPreferences();

                // Map preferences securely against Google API array
                const attached = upcoming.map(e => ({
                    ...e,
                    reminder_mode: prefs[e.id]?.mode || 0,
                    offset_min: prefs[e.id]?.offset || 0
                }));

                setEvents(attached);
            } else {
                setError("Cannot fetch schedule: missing auth token.");
            }
        } catch (err) {
            setError(err.message || "Unknown error fetching calendar.");
        } finally {
            setLoading(false);
        }
    };

    return {
        events,
        loading,
        error,
        currentUser,
        login,
        logout,
        refreshEvents: fetchEvents
    };
};
