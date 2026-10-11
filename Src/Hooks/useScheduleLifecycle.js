import { useState, useEffect } from 'react';
import { AppState } from 'react-native';

export const useScheduleLifecycle = (events = []) => {
    const [categorized, setCategorized] = useState({
        upcoming: [],
        ongoing: [],
        past: []
    });

    // Helper to evaluate where events physically lie currently
    const evaluateLifecycle = () => {
        const now = new Date();
        const nowMs = now.getTime();

        const upcoming = [];
        const ongoing = [];
        const past = [];

        events.forEach(event => {
            // Google API dateTime format mapping
            const startMs = new Date(event.start.dateTime || event.start.date).getTime();
            const endMs = new Date(event.end.dateTime || event.end.date).getTime();

            if (startMs > nowMs) {
                upcoming.push(event);
            } else if (startMs <= nowMs && endMs > nowMs) {
                ongoing.push(event);
            } else {
                past.push(event);
            }
        });

        setCategorized({ upcoming, ongoing, past });
    };

    useEffect(() => {
        evaluateLifecycle();

        // 1. Re-evaluate on a set interval natively
        const interval = setInterval(() => {
            evaluateLifecycle();
        }, 30000); // 30 seconds

        // 2. Re-evaluate when AppState returns to active
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                evaluateLifecycle();
            }
        });

        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [events]);

    return categorized;
};
