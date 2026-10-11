import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashboardScreen from '../Screens/DashboardScreen';
import UsageScreen from '../Screens/UsageScreen';
import ScheduleScreen from '../Screens/ScheduleScreen';
import FocusScreen from '../Screens/FocusScreen';
import ReportScreen from '../Screens/ReportScreen';

import TabIcon from '../Components/TabIcon';
import { Routes } from '../Constants/Routes';
import { Theme } from '../Theme/Theme';

const Tab = createBottomTabNavigator();

/**
 * Custom Tab Bar respecting the FocusFlow Navigation Contract v2:
 * - Equal 5-column layout (20% each)
 * - 24dp icons with consistent 2dp stroke
 * - 4dp icon-to-label gap
 * - Identical label font size & weight
 * - Active: White icon and label inside rounded indigo #5056D8 pill
 * - Inactive: Slate #727A91 icon and label on transparent background
 * - Respects Android bottom safe area
 */
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const iconColor = isFocused ? '#FFFFFF' : '#727A91';
        const labelColor = isFocused ? '#FFFFFF' : '#727A91';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel || `${label} Tab`}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <View style={[styles.pillContainer, isFocused ? styles.activePill : styles.inactivePill]}>
              <TabIcon name={route.name} color={iconColor} size={24} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: labelColor }
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name={Routes.HOME} component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name={Routes.USAGE} component={UsageScreen} options={{ tabBarLabel: 'Usage' }} />
      <Tab.Screen name={Routes.SCHEDULE} component={ScheduleScreen} options={{ tabBarLabel: 'Schedule' }} />
      <Tab.Screen name={Routes.FOCUS} component={FocusScreen} options={{ tabBarLabel: 'Focus' }} />
      <Tab.Screen name={Routes.REPORTS} component={ReportScreen} options={{ tabBarLabel: 'Reports' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF5',
    paddingTop: 8,
    // Soft shadow / elevation
    ...Platform.select({
      android: {
        elevation: 10,
      },
      ios: {
        shadowColor: '#1A2035',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
    }),
  },
  tabItem: {
    flex: 1, // Equal-width tabs (20% each)
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 62,
    minHeight: 52,
  },
  activePill: {
    backgroundColor: '#5056D8',
    borderRadius: 20 // Indigo active pill
  },
  inactivePill: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4, // Strict 4dp icon-to-label gap
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
