import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { usePlaylistsStore } from '../src/stores/playlists';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import type { Playlist, PlaylistItem } from '../src/types';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlaylist = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getPlaylist(id);
      setPlaylist(data);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load playlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  const handleRemoveItem = (itemId: string) => {
    if (!id) return;
    Alert.alert('Remove Item', 'Remove this item from the playlist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await usePlaylistsStore.getState().removePlaylistItem(id, itemId);
            setPlaylist((prev) =>
              prev
                ? { ...prev, items: prev.items?.filter((i) => i.id !== itemId) }
                : prev,
            );
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Remove failed');
          }
        },
      },
    ]);
  };

  const handleMoveItem = async (itemIndex: number, direction: 'up' | 'down') => {
    if (!id || !playlist?.items) return;
    const items = [...playlist.items];
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap locally
    [items[itemIndex], items[targetIndex]] = [items[targetIndex], items[itemIndex]];
    setPlaylist((prev) => (prev ? { ...prev, items } : prev));

    // Persist order
    try {
      const itemIds = items.map((i) => i.id);
      await usePlaylistsStore.getState().reorderPlaylist(id, itemIds);
    } catch (err) {
      // Revert on error
      fetchPlaylist();
      Alert.alert('Error', err instanceof Error ? err.message : 'Reorder failed');
    }
  };

  const renderItem = ({ item, index }: { item: PlaylistItem; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === (playlist?.items?.length ?? 0) - 1;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemContent}>
          <Text style={styles.itemOrder}>{index + 1}</Text>
          <View style={styles.itemText}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.content?.name ?? 'Unknown content'}
            </Text>
            <Text style={styles.itemMeta}>{item.duration}s</Text>
          </View>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            onPress={() => handleMoveItem(index, 'up')}
            disabled={isFirst}
            style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
          >
            <Text style={styles.arrowText}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleMoveItem(index, 'down')}
            disabled={isLast}
            style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
          >
            <Text style={styles.arrowText}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemoveItem(item.id)} style={styles.removeBtn}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!playlist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Playlist not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Playlist Header */}
      <View style={styles.header}>
        <Text style={styles.playlistName}>{playlist.name}</Text>
        {playlist.description ? (
          <Text style={styles.playlistDesc}>{playlist.description}</Text>
        ) : null}
        <Text style={styles.itemCount}>
          {playlist.items?.length ?? 0} item{(playlist.items?.length ?? 0) !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Items List */}
      <FlatList
        data={playlist.items ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPlaylist(); }}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items in this playlist</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playlistName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  playlistDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  itemCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemOrder: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
    width: 24,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  itemMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.dangerDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  removeText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
});
