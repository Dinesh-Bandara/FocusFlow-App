import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LoadingView() {
  return (
    <View style={styles.container}>
      <Text>LoadingView</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
