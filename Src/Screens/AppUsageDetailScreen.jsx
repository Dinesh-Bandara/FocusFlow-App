import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AppUsageDetailScreen() {
  return (
    <View style={styles.container}>
      <Text>AppUsageDetailScreen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
