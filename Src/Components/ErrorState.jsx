import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ErrorState() {
  return (
    <View style={styles.container}>
      <Text>ErrorState</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
