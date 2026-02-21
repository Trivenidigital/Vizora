import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '../constants/theme';

type Props = {
  status: 'online' | 'offline' | 'pairing';
};

const statusConfig = {
  online: { color: colors.online, label: 'Online' },
  offline: { color: colors.offline, label: 'Offline' },
  pairing: { color: colors.pairing, label: 'Pairing' },
} as const;

export function StatusBadge({ status }: Props) {
  const config = statusConfig[status] ?? statusConfig.offline;

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
