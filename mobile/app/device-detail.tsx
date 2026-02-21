import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { useDevicesStore } from '../src/stores/devices';
import { useRealtimeEvents } from '../src/hooks/useRealtimeEvents';
import { useScreenshotListener } from '../src/hooks/useScreenshotListener';
import { StatusBadge } from '../src/components/StatusBadge';
import { PlaylistPicker } from '../src/components/PlaylistPicker';
import { ContentPushModal } from '../src/components/ContentPushModal';
import { showConfirmDialog } from '../src/components/ConfirmDialog';
import { timeAgo, formatDate } from '../src/utils/formatters';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import type { Display } from '../src/types';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [display, setDisplay] = useState<Display | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Editable fields
  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [location, setLocation] = useState('');

  // Modals
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [contentPushVisible, setContentPushVisible] = useState(false);

  // Screenshot
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const { screenshot } = useScreenshotListener(id);

  // Real-time status
  const { isConnected } = useRealtimeEvents();
  const storeDisplay = useDevicesStore((s) => s.displays.find((d) => d.id === id));

  const fetchDisplay = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getDisplay(id);
      setDisplay(data);
      setNickname(data.nickname || '');
      setLocation(data.location || '');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load display');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDisplay();
  }, [fetchDisplay]);

  // Sync real-time status from store
  useEffect(() => {
    if (storeDisplay && display) {
      setDisplay((prev) =>
        prev ? { ...prev, status: storeDisplay.status, lastSeen: storeDisplay.lastSeen } : prev,
      );
    }
  }, [storeDisplay?.status, storeDisplay?.lastSeen]);

  // Handle real-time screenshot
  useEffect(() => {
    if (screenshot?.url) {
      setScreenshotUrl(screenshot.url);
      setScreenshotLoading(false);
    }
  }, [screenshot]);

  // Fetch existing screenshot on load
  useEffect(() => {
    if (!id) return;
    api.getScreenshot(id).then((data) => {
      if (data?.url) setScreenshotUrl(data.url);
    }).catch(() => {});
  }, [id]);

  const handleSaveNickname = async () => {
    if (!id) return;
    try {
      const updated = await api.updateDisplay(id, { nickname });
      setDisplay((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditingNickname(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleSaveLocation = async () => {
    if (!id) return;
    try {
      const updated = await api.updateDisplay(id, { location });
      setDisplay((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditingLocation(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handlePlaylistSelect = async (playlistId: string | null) => {
    if (!id) return;
    try {
      const updated = await api.updateDisplay(id, { currentPlaylistId: playlistId });
      setDisplay((prev) => (prev ? { ...prev, ...updated } : prev));
      setPlaylistPickerVisible(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleRequestScreenshot = async () => {
    if (!id) return;
    setScreenshotLoading(true);
    try {
      await api.requestScreenshot(id);
      // Screenshot will arrive via WebSocket (useScreenshotListener)
      // Set a timeout fallback
      setTimeout(() => setScreenshotLoading(false), 15000);
    } catch (err) {
      setScreenshotLoading(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to request screenshot');
    }
  };

  const handleDelete = () => {
    if (!id) return;
    showConfirmDialog({
      title: 'Delete Display',
      message: 'This will remove the display from your organization. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await useDevicesStore.getState().removeDisplay(id);
          router.back();
        } catch (err) {
          Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
        }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!display) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Display not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDisplay(); }}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
      >
        {/* Header: Name + Status */}
        <View style={styles.headerSection}>
          {editingNickname ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={nickname}
                onChangeText={setNickname}
                autoFocus
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={handleSaveNickname} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingNickname(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingNickname(true)} activeOpacity={0.7}>
              <Text style={styles.displayName}>
                {display.nickname || display.deviceIdentifier}
              </Text>
              <Text style={styles.editHint}>Tap to edit name</Text>
            </TouchableOpacity>
          )}
          <StatusBadge status={display.status} />
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Info</Text>

          {editingLocation ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter location"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveLocation} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingLocation(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingLocation(true)} activeOpacity={0.7}>
              <InfoRow label="Location" value={display.location || 'Not set'} editable />
            </TouchableOpacity>
          )}

          <InfoRow label="Orientation" value={display.orientation || 'N/A'} />
          <InfoRow label="Resolution" value={display.resolution || 'N/A'} />
          <InfoRow label="Device ID" value={display.deviceIdentifier} />
          <InfoRow label="Created" value={formatDate(display.createdAt)} />
          <InfoRow label="Last Seen" value={timeAgo(display.lastSeen || display.lastHeartbeat)} />
        </View>

        {/* Current Playlist Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Playlist</Text>
          <TouchableOpacity
            style={styles.playlistRow}
            onPress={() => setPlaylistPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.playlistName}>
              {display.currentPlaylist?.name || 'None assigned'}
            </Text>
            <Text style={styles.changeBtn}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Screenshot Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Screenshot</Text>
          {screenshotUrl ? (
            <Image
              source={{ uri: screenshotUrl }}
              style={styles.screenshotImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.screenshotPlaceholder}>
              <Text style={styles.placeholderText}>No screenshot available</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, screenshotLoading && styles.actionBtnDisabled]}
            onPress={handleRequestScreenshot}
            disabled={screenshotLoading}
            activeOpacity={0.7}
          >
            {screenshotLoading ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.actionBtnText}>Request Screenshot</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Commands */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Commands</Text>
          <View style={styles.commandsRow}>
            <TouchableOpacity
              style={styles.commandBtn}
              onPress={() => setContentPushVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.commandBtnText}>Push Content</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, { color: colors.danger }]}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteBtnText}>Delete Display</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modals */}
      <PlaylistPicker
        visible={playlistPickerVisible}
        currentPlaylistId={display.currentPlaylistId}
        onSelect={handlePlaylistSelect}
        onClose={() => setPlaylistPickerVisible(false)}
      />
      <ContentPushModal
        visible={contentPushVisible}
        displayId={id!}
        onClose={() => setContentPushVisible(false)}
      />
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  editable,
}: {
  label: string;
  value: string;
  editable?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>
        {value}
        {editable ? ' ✎' : ''}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  value: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '60%',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  displayName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    maxWidth: 250,
  },
  editHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  editInput: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    minWidth: 150,
  },
  saveBtn: {
    backgroundColor: colors.teal,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  saveBtnText: {
    color: colors.bg,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  cancelBtn: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  playlistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistName: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  changeBtn: {
    fontSize: fontSize.sm,
    color: colors.teal,
    fontWeight: '600',
  },
  screenshotImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgInput,
  },
  screenshotPlaceholder: {
    height: 120,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  actionBtn: {
    backgroundColor: colors.teal,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: colors.bg,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  commandsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  commandBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  commandBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  dangerCard: {
    borderColor: colors.dangerDim,
  },
  deleteBtn: {
    backgroundColor: colors.dangerDim,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
});
