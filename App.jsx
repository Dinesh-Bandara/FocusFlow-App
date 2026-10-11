import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './Src/Navigation/AppNavigator';

import { Routes } from './Src/Constants/Routes';
import { navigate, navigationRef } from './Src/Navigation/NavigationRef';

function App(props) {
  React.useEffect(() => {
    // If Android Alarm Notification started the app
    if (props.startupStartFocus) {
      // Wait for navigation container to mount
      const unsubscribe = navigationRef.addListener('ready', () => {
        navigate(Routes.FOCUS, { eventId: props.startupEventId });
      });
      return unsubscribe;
    }
  }, [props.startupStartFocus, props.startupEventId]);

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
