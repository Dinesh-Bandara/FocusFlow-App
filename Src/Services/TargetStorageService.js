import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_FOCUS_GOAL = '@focusflow_daily_focus_goal';
const KEY_USAGE_TARGET = '@focusflow_daily_usage_target';
const KEY_ACTIVE_SESSION = '@focusflow_active_session';

const DEFAULT_FOCUS_GOAL = 240; // 4 hours in minutes
const DEFAULT_USAGE_TARGET = 240; // 4 hours in minutes

export const TargetStorageService = {
    getFocusGoal: async () => {
        try {
            const val = await AsyncStorage.getItem(KEY_FOCUS_GOAL);
            if (val !== null) {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 0) return parsed;
            }
        } catch (e) {
            console.warn('Error reading focus goal:', e);
        }
        return DEFAULT_FOCUS_GOAL;
    },

    setFocusGoal: async (goalMinutes) => {
        try {
            await AsyncStorage.setItem(KEY_FOCUS_GOAL, String(goalMinutes));
            return true;
        } catch (e) {
            console.error('Error saving focus goal:', e);
            return false;
        }
    },

    getUsageTarget: async () => {
        try {
            const val = await AsyncStorage.getItem(KEY_USAGE_TARGET);
            if (val !== null) {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 0) return parsed;
            }
        } catch (e) {
            console.warn('Error reading usage target:', e);
        }
        return DEFAULT_USAGE_TARGET;
    },

    setUsageTarget: async (targetMinutes) => {
        try {
            await AsyncStorage.setItem(KEY_USAGE_TARGET, String(targetMinutes));
            return true;
        } catch (e) {
            console.error('Error saving usage target:', e);
            return false;
        }
    },

    getActiveSession: async () => {
        try {
            const val = await AsyncStorage.getItem(KEY_ACTIVE_SESSION);
            if (val) {
                return JSON.parse(val);
            }
        } catch (e) {
            console.warn('Error reading active session checkpoint:', e);
        }
        return null;
    },

    setActiveSession: async (sessionData) => {
        try {
            if (!sessionData) {
                await AsyncStorage.removeItem(KEY_ACTIVE_SESSION);
            } else {
                await AsyncStorage.setItem(KEY_ACTIVE_SESSION, JSON.stringify(sessionData));
            }
            return true;
        } catch (e) {
            console.error('Error saving active session checkpoint:', e);
            return false;
        }
    },

    clearActiveSession: async () => {
        try {
            await AsyncStorage.removeItem(KEY_ACTIVE_SESSION);
            return true;
        } catch (e) {
            console.warn('Error clearing active session checkpoint:', e);
            return false;
        }
    },

    getDistractingApps: async () => {
        try {
            const val = await AsyncStorage.getItem('@focusflow_distracting_apps');
            if (val) {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Error reading distracting apps:', e);
        }
        return [
            'com.google.android.youtube',
            'com.instagram.android',
            'com.facebook.katana',
            'com.zhiliaoapp.musically',
            'com.twitter.android',
            'com.reddit.frontpage',
            'com.whatsapp',
            'com.netflix.mediaclient',
        ];
    },

    setDistractingApps: async (appsList) => {
        try {
            await AsyncStorage.setItem('@focusflow_distracting_apps', JSON.stringify(appsList));
            return true;
        } catch (e) {
            console.error('Error saving distracting apps:', e);
            return false;
        }
    },
};
