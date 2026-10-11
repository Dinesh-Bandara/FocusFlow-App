import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export const GoogleAuthService = {

    configure: () => {
        GoogleSignin.configure({
            // We must use the Web Client ID for generating server tokens, NOT the Android ID.
            webClientId: '109152524668-trt7hbr1jdadrneguue3vbsd72ebvfmb.apps.googleusercontent.com',
            scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
            offlineAccess: true,
            forceCodeForRefreshToken: true,
        });
    },

    signIn: async () => {
        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const userInfo = await GoogleSignin.signIn();
            const tokens = await GoogleSignin.getTokens();
            return {
                userInfo,
                accessToken: tokens.accessToken
            };
        } catch (error) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('User cancelled login flow');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                console.log('Login is already in progress');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                console.warn('Play services not available or outdated');
            } else {
                console.error('Unknown login error', error);
            }
            return null;
        }
    },

    signOut: async () => {
        try {
            await GoogleSignin.signOut();
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    },

    getCurrentUser: async () => {
        try {
            const currentUser = await GoogleSignin.getCurrentUser();
            return currentUser;
        } catch (error) {
            return null;
        }
    },

    getTokens: async () => {
        try {
            const tokens = await GoogleSignin.getTokens();
            return tokens.accessToken;
        } catch (error) {
            return null;
        }
    }
};

// Initialize immediately upon import to avoid "Activity is null" races
GoogleAuthService.configure();
