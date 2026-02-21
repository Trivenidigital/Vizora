import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

type Props = {
  isConnected: boolean;
};

export function ConnectionStatus({ isConnected }: Props) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: isConnected ? colors.teal : colors.offline },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
});
