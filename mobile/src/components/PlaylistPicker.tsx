import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import type { Playlist } from '../types';

type Props = {
  visible: boolean;
  currentPlaylistId: string | null;
  onSelect: (playlistId: string | null) => void;
  onClose: () => void;
};

export function PlaylistPicker({ visible, currentPlaylistId, onSelect, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      api
        .getPlaylists()
        .then((result) => {
          setPlaylists(Array.isArray(result) ? result : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const renderItem = ({ item }: { item: Playlist }) => {
    const isSelected = item.id === currentPlaylistId;
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.radio}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <View style={styles.itemText}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item._count?.items != null && (
            <Text style={styles.itemMeta}>{item._count.items} items</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Playlist</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* None option */}
          <TouchableOpacity
            style={[styles.item, currentPlaylistId === null && styles.itemSelected]}
            onPress={() => onSelect(null)}
            activeOpacity={0.7}
          >
            <View style={styles.radio}>
              {currentPlaylistId === null && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.itemName}>None</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color={colors.teal} style={styles.loader} />
          ) : (
            <FlatList
              data={playlists}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '60%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: fontSize.md,
    color: colors.teal,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemSelected: {
    backgroundColor: colors.tealDim,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.teal,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  itemMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loader: {
    padding: spacing.xl,
  },
});
