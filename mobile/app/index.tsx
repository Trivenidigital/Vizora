import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/auth';
import { colors } from '../src/constants/theme';

export default function Index() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace('/(main)/devices');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
