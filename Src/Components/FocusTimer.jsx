import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../Theme/Theme';
import CustomButton from './CustomButton';

export default function FocusTimer({ initialMinutes = 25, onComplete, onEnd }) {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(seconds => seconds - 1);
      }, 1000);
    } else if (isActive && secondsLeft === 0) {
      setIsActive(false);
      clearInterval(interval);
      if (onComplete) onComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const endTimer = () => {
    setIsActive(false);
    if (onEnd) onEnd(initialMinutes * 60 - secondsLeft);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const formattedTime = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  const progress = 1 - (secondsLeft / (initialMinutes * 60));

  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Text style={styles.timeText}>{formattedTime}</Text>
        <Text style={styles.subtitle}>{isActive ? 'Focusing' : 'Paused'}</Text>
      </View>

      <View style={styles.controls}>
        <CustomButton
          title={isActive ? "Pause" : "Resume"}
          onPress={toggleTimer}
          style={styles.button}
        />
        <CustomButton
          title="End Early"
          variant="secondary"
          onPress={endTimer}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.xl,
  },
  circle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 8,
    borderColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    backgroundColor: Theme.colors.surface,
  },
  timeText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  subtitle: {
    fontSize: 18,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginHorizontal: Theme.spacing.sm,
    width: 130,
  }
});
