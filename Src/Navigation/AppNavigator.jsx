import React, { useCallback } from 'react';
import { NativeModules, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SettingsScreen from '../Screens/SettingsScreen';
import PermissionScreen from '../Screens/PermissionScreen';
import SplashScreen from '../Screens/SplashScreen';
import StartupErrorScreen from '../Screens/StartupErrorScreen';
import { Routes } from '../Constants/Routes';

import BottomTabNavigator from './BottomTabNavigator';
import { navigationRef } from './NavigationRef';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ startupState = 'ready', startupError = null, onRetry, onNavigationReady }) {
  const onContentLayout = useCallback(() => {
    if (startupState !== 'initializing') {
      onNavigationReady?.();
      // The native overlay is released only once the destination has laid out.
      NativeModules.SplashModule?.hide?.().catch(error =>
        console.warn('Could not dismiss startup branding:', error),
      );
    }
  }, [startupState, onNavigationReady]);

  return (
    <View key={startupState} style={styles.container} onLayout={onContentLayout}>
      <NavigationContainer
        ref={navigationRef}
        onReady={onNavigationReady}
        onStateChange={onNavigationReady}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'none',
          }}
        >
          {startupState === 'initializing' ? (
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ animation: 'none' }}
            />
          ) : startupState === 'error' ? (
            <Stack.Screen name="StartupError" options={{ animation: 'none' }}>
              {(props) => (
                <StartupErrorScreen
                  {...props}
                  error={startupError}
                  onRetry={onRetry}
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
              <Stack.Screen
                name={Routes.SETTINGS}
                component={SettingsScreen}
                options={{ headerShown: true, title: 'Settings' }}
              />
              <Stack.Screen
                name="Permissions"
                component={PermissionScreen}
                options={{ headerShown: true, title: 'Permissions' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FF' },
});
