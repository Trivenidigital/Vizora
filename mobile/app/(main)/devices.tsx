import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Display } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';

export default function DevicesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDisplays = useCallback(async () => {
    try {
      const res = await api.getDisplays();
      // API may return data in different shapes
      const list = res.data ?? res.displays ?? res.items ?? [];
      setDisplays(Array.isArray(list) ? list : []);
    } catch {
      // Silently fail — user sees empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDisplays();
    }, [fetchDisplays]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDisplays();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const statusColor = (status: Display['status']) => {
    switch (status) {
      case 'online':
        return colors.online;
      case 'offline':
        return colors.offline;
      case 'pairing':
        return colors.pairing;
      default:
        return colors.textMuted;
    }
  };

  const renderDevice = ({ item }: { item: Display }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
        <Text style={styles.deviceName} numberOfLines={1}>
          {item.nickname || item.deviceIdentifier}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
        {item.location ? (
          <Text style={styles.metaText}>{item.location}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No Displays Yet</Text>
        <Text style={styles.emptyText}>
          Scan a QR code on a display screen to pair it with your organization.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Displays</Text>
          <Text style={styles.headerSubtitle}>{user?.name ?? 'My Organization'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Device List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={displays}
          renderItem={renderDevice}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
        />
      )}

      {/* Scan FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(main)/scan')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabText}>Scan QR</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  deviceName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginLeft: 18,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
