import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import type { Content } from '../types';

type Props = {
  visible: boolean;
  displayId: string;
  onClose: () => void;
};

export function ContentPushModal({ visible, displayId, onClose }: Props) {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duration, setDuration] = useState('');
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setSelectedId(null);
      setDuration('');
      api
        .getContent()
        .then((result) => {
          setContent(Array.isArray(result) ? result : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handlePush = async () => {
    if (!selectedId) return;
    setPushing(true);
    try {
      const dur = duration ? parseInt(duration, 10) : undefined;
      await api.pushContent(displayId, selectedId, dur);
      Alert.alert('Success', 'Content pushed to display');
      onClose();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  };

  const typeIcon = (type: Content['type']) => {
    switch (type) {
      case 'image': return '🖼';
      case 'video': return '🎬';
      case 'url': return '🔗';
      case 'html': return '📄';
      default: return '📁';
    }
  };

  const renderItem = ({ item }: { item: Content }) => {
    const isSelected = item.id === selectedId;
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.typeIcon}>{typeIcon(item.type)}</Text>
        <View style={styles.itemText}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.type}</Text>
        </View>
        {isSelected && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Push Content</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.teal} style={styles.loader} />
          ) : (
            <FlatList
              data={content}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No content available</Text>
              }
            />
          )}

          {selectedId && (
            <View style={styles.footer}>
              <TextInput
                style={styles.durationInput}
                placeholder="Duration (seconds, optional)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={duration}
                onChangeText={setDuration}
              />
              <TouchableOpacity
                style={styles.pushBtn}
                onPress={handlePush}
                disabled={pushing}
                activeOpacity={0.7}
              >
                {pushing ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.pushBtnText}>Push</Text>
                )}
              </TouchableOpacity>
            </View>
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
    maxHeight: '70%',
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
    color: colors.textMuted,
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
  typeIcon: {
    fontSize: fontSize.lg,
    marginRight: spacing.sm,
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
  check: {
    fontSize: fontSize.lg,
    color: colors.teal,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  durationInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
  },
  pushBtn: {
    backgroundColor: colors.teal,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pushBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.bg,
  },
  loader: {
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
});
