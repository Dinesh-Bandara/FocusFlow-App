import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SettingsScreen from '../Screens/SettingsScreen';
import PermissionScreen from '../Screens/PermissionScreen';
import { Routes } from '../Constants/Routes';
import { Theme } from '../Theme/Theme';

import BottomTabNavigator from './BottomTabNavigator';
import { navigationRef } from './NavigationRef';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* We can add Onboarding and Permission screens conditionally here based on state */}
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen name={Routes.SETTINGS} component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="Permissions" component={PermissionScreen} options={{ headerShown: true, title: 'Permissions' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
