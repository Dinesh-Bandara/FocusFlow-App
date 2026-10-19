import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './Src/Navigation/AppNavigator';
import { useStartup } from './Src/Hooks/useStartup';

function App(props) {
  const { startupState, startupError, retry, onNavigationReady } = useStartup(props);

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AppNavigator
        startupState={startupState}
        startupError={startupError}
        onRetry={retry}
        onNavigationReady={onNavigationReady}
      />
    </SafeAreaProvider>
  );
}

export default App;
