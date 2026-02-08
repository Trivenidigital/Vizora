import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';

export default function PairConfirmScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!code) return;

    setLoading(true);
    try {
      const res = await api.completePairing(code, nickname.trim() || undefined);
      Alert.alert(
        'Paired Successfully',
        `"${res.display.nickname}" is now connected to your organization.`,
        [
          {
            text: 'OK',
            onPress: () => router.dismissAll(),
          },
        ],
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not complete pairing. The code may have expired.';
      Alert.alert('Pairing Failed', message, [
        { text: 'Try Again', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.codeContainer}>
          <Text style={styles.label}>Pairing Code</Text>
          <Text style={styles.code}>{code}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Display Name (optional)</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. Lobby TV, Conference Room A"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.hint}>
            Give this display a name to identify it easily. You can change this later.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.confirmText}>Pair Display</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  codeContainer: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  code: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 8,
  },
  field: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.xl,
  },
  confirmButton: {
    backgroundColor: colors.teal,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.bg,
  },
  cancelButton: {
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
