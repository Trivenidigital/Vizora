import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { useContentStore } from '../src/stores/content';
import { formatBytes, formatDate } from '../src/utils/formatters';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import type { Content } from '../src/types';

const typeIcons: Record<Content['type'], string> = {
  image: '🖼',
  video: '🎬',
  url: '🔗',
  html: '📄',
};

export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getContentItem(id)
      .then(setContent)
      .catch((err) => {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load content');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Content', 'This will permanently delete this content item.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await useContentStore.getState().deleteContent(id);
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
            setDeleting(false);
          }
        },
      },
    ]);
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

  if (!content) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Content not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Preview */}
        {content.type === 'image' && content.url ? (
          <Image
            source={{ uri: content.url }}
            style={styles.preview}
            resizeMode="contain"
          />
        ) : content.type === 'video' && content.thumbnailUrl ? (
          <Image
            source={{ uri: content.thumbnailUrl }}
            style={styles.preview}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewIcon}>{typeIcons[content.type] ?? '📁'}</Text>
            <Text style={styles.previewType}>{content.type.toUpperCase()}</Text>
          </View>
        )}

        {/* Name */}
        <Text style={styles.contentName}>{content.name}</Text>

        {/* Metadata Card */}
        <View style={styles.card}>
          <InfoRow label="Type" value={content.type} />
          <InfoRow label="MIME Type" value={content.mimeType || 'N/A'} />
          <InfoRow label="File Size" value={formatBytes(content.fileSize)} />
          {content.duration ? (
            <InfoRow label="Duration" value={`${content.duration}s`} />
          ) : null}
          <InfoRow label="Status" value={content.status} />
          <InfoRow label="Created" value={formatDate(content.createdAt)} />
        </View>

        {/* URL Display */}
        {content.type === 'url' && content.url ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>URL</Text>
            <Text style={styles.urlText} numberOfLines={3}>
              {content.url}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <TouchableOpacity
          style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.7}
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Text style={styles.deleteBtnText}>Delete Content</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
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
  },
});

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  preview: {
    width: '100%',
    height: 250,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    marginBottom: spacing.md,
  },
  previewPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  previewType: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  contentName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
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
  urlText: {
    fontSize: fontSize.sm,
    color: colors.cyan,
  },
  deleteBtn: {
    backgroundColor: colors.dangerDim,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  deleteBtnText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
