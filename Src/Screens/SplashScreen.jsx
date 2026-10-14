import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FocusFlowIcon from '../Components/FocusFlowIcon';

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive sizing based on viewport
  const iconSize = Math.min(Math.round(width * 0.36), 148);
  const bottomInset = Math.max(insets.bottom, 24);

  return (
    <View
      style={styles.container}
      accessibilityRole="none"
      accessibilityLabel="FocusFlow Splash Screen"
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F7F8FF"
        translucent={Platform.OS === 'android'}
      />

      {/* Center Branding */}
      <View style={styles.centerContainer}>
        <FocusFlowIcon size={iconSize} useVector />

        <View style={styles.titleRow}>
          <Text
            style={styles.focusText}
            maxFontSizeMultiplier={1.2}
            accessible={true}
            accessibilityLabel="FocusFlow"
          >
            Focus
          </Text>
          <Text
            style={styles.flowText}
            maxFontSizeMultiplier={1.2}
            accessible={false}
          >
            Flow
          </Text>
        </View>
      </View>

      {/* Bottom Branding */}
      <View style={[styles.bottomContainer, { paddingBottom: bottomInset }]}>
        <Text
          style={styles.poweredByText}
          maxFontSizeMultiplier={1.2}
          accessible={true}
          accessibilityLabel="powered by TDBro"
        >
          powered by
        </Text>
        <View style={styles.tdBroRow}>
          <Text
            style={styles.tdText}
            maxFontSizeMultiplier={1.2}
            accessible={false}
          >
            TD
          </Text>
          <Text
            style={styles.broText}
            maxFontSizeMultiplier={1.2}
            accessible={false}
          >
            Bro
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // Slightly offset center vertically to balance visual weight against bottom branding
    marginTop: -30,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 22,
  },
  focusText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#20283A', // Dark Navy
    letterSpacing: -0.6,
  },
  flowText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2563EB', // Flow Blue
    letterSpacing: -0.6,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poweredByText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#727A91', // Slate
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  tdBroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  tdText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#000000', // Black
    letterSpacing: -0.3,
  },
  broText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#E53935', // Red
    letterSpacing: -0.3,
  },
});
