import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useContentStore } from '../../src/stores/content';
import { formatBytes } from '../../src/utils/formatters';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import type { Content, ContentFilterParams } from '../../src/types';

const TYPE_FILTERS = ['all', 'image', 'video', 'url', 'html'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const typeIcons: Record<Content['type'], string> = {
  image: '🖼',
  video: '🎬',
  url: '🔗',
  html: '📄',
};

export default function ContentScreen() {
  const router = useRouter();
  const items = useContentStore((s) => s.items);
  const isLoading = useContentStore((s) => s.isLoading);
  const fetchContent = useContentStore((s) => s.fetchContent);

  const [activeFilter, setActiveFilter] = useState<TypeFilter>('all');

  const loadContent = useCallback(
    (filter?: TypeFilter) => {
      const params: ContentFilterParams = {};
      if (filter && filter !== 'all') {
        params.type = filter;
      }
      fetchContent(params);
    },
    [fetchContent],
  );

  useFocusEffect(
    useCallback(() => {
      loadContent(activeFilter);
    }, [loadContent, activeFilter]),
  );

  const handleFilterChange = (filter: TypeFilter) => {
    setActiveFilter(filter);
    loadContent(filter);
  };

  const renderItem = ({ item }: { item: Content }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/content-detail?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <Text style={styles.typeIcon}>{typeIcons[item.type] ?? '📁'}</Text>
      <View style={styles.cardText}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          {item.fileSize ? (
            <Text style={styles.metaText}>{formatBytes(item.fileSize)}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No Content</Text>
        <Text style={styles.emptyText}>
          Upload images, videos, or URLs to display on your screens.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Content</Text>
      </View>

      {/* Type Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {TYPE_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => handleFilterChange(filter)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content List */}
      {isLoading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && items.length > 0}
              onRefresh={() => loadContent(activeFilter)}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
        />
      )}

      {/* Upload FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/upload')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabText}>Upload</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.tealDim,
    borderColor: colors.teal,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.teal,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeIcon: {
    fontSize: fontSize.xl,
    marginRight: spacing.sm,
  },
  cardText: {
    flex: 1,
  },
  cardName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  typeBadge: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    backgroundColor: colors.teal,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    elevation: 4,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.bg,
    marginRight: spacing.xs,
  },
  fabText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.bg,
  },
});
