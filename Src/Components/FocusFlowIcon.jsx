import React from 'react';
import { View, Image, Platform, StyleSheet } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';

/**
 * FocusFlowIcon component:
 * Displays the FocusFlow branded icon.
 * Preserves the indigo background, white ring/checkmark, and periwinkle accent.
 */
export default function FocusFlowIcon({ size = 140, useVector = false, style }) {
  const borderRadius = Math.round(size * 0.22);

  if (useVector) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Indigo rounded background */}
          <Rect width="100" height="100" rx="22" ry="22" fill="#5056D8" />

          {/* White circular arc */}
          <Path
            d="M 75 52 A 26 26 0 1 1 50 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="7.5"
            strokeLinecap="round"
          />

          {/* Periwinkle accent arc */}
          <Path
            d="M 57 25 A 26 26 0 0 1 76 43"
            fill="none"
            stroke="#8094FF"
            strokeWidth="7.5"
            strokeLinecap="round"
          />

          {/* White checkmark inside */}
          <Path
            d="M 39 49 L 47 57 L 63 41"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.iconContainer,
        {
          width: size,
          height: size,
          borderRadius: borderRadius,
        },
        style,
      ]}
    >
      <Image
        source={require('../Assets/Icons/focusflow_icon.png')}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel="FocusFlow App Icon"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    overflow: 'hidden',
    backgroundColor: '#5056D8',
    ...Platform.select({
      android: {
        elevation: 6,
      },
      ios: {
        shadowColor: '#5056D8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
    }),
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
