import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UsageChart() {
  return (
    <View style={styles.container}>
      <Text>UsageChart</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
