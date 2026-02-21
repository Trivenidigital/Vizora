import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useUpload } from '../src/hooks/useUpload';
import { UploadProgress } from '../src/components/UploadProgress';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';

export default function UploadScreen() {
  const router = useRouter();
  const { state, upload, reset } = useUpload();

  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [customName, setCustomName] = useState('');

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedAsset(result.assets[0]);
      reset();
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedAsset(result.assets[0]);
      reset();
    }
  };

  const handleUpload = async () => {
    if (!selectedAsset) return;

    const uri = selectedAsset.uri;
    const fileName = customName.trim() || selectedAsset.fileName || 'upload';
    const mimeType = selectedAsset.mimeType || (selectedAsset.type === 'video' ? 'video/mp4' : 'image/jpeg');

    try {
      await upload(uri, fileName, mimeType);
      // Auto-navigate back after short delay to show success
      setTimeout(() => router.back(), 800);
    } catch {
      // Error already set in upload state
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Source Selection */}
        {!selectedAsset && (
          <View style={styles.sourceSection}>
            <Text style={styles.sectionTitle}>Select Media</Text>
            <TouchableOpacity style={styles.sourceBtn} onPress={pickFromLibrary} activeOpacity={0.7}>
              <Text style={styles.sourceIcon}>📷</Text>
              <Text style={styles.sourceBtnText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={takePhoto} activeOpacity={0.7}>
              <Text style={styles.sourceIcon}>📸</Text>
              <Text style={styles.sourceBtnText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preview */}
        {selectedAsset && (
          <View style={styles.previewSection}>
            <Image
              source={{ uri: selectedAsset.uri }}
              style={styles.preview}
              resizeMode="contain"
            />

            <TextInput
              style={styles.nameInput}
              placeholder="Content name (optional)"
              placeholderTextColor={colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
            />

            {/* Upload State */}
            {state.status === 'uploading' && (
              <View style={styles.progressSection}>
                <UploadProgress progress={state.progress} />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}

            {state.status === 'success' && (
              <View style={styles.successSection}>
                <Text style={styles.successText}>Upload complete!</Text>
              </View>
            )}

            {state.status === 'error' && (
              <View style={styles.errorSection}>
                <Text style={styles.errorText}>{state.message}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() => { setSelectedAsset(null); reset(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.uploadBtn,
                  (state.status === 'uploading' || state.status === 'success') && styles.uploadBtnDisabled,
                ]}
                onPress={handleUpload}
                disabled={state.status === 'uploading' || state.status === 'success'}
                activeOpacity={0.7}
              >
                <Text style={styles.uploadBtnText}>
                  {state.status === 'uploading' ? 'Uploading...' : state.status === 'error' ? 'Retry' : 'Upload'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    padding: spacing.md,
  },
  sourceSection: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceIcon: {
    fontSize: fontSize.xl,
    marginRight: spacing.md,
  },
  sourceBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  previewSection: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 250,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    marginBottom: spacing.md,
  },
  nameInput: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  uploadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  successSection: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.online,
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorSection: {
    backgroundColor: colors.dangerDim,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  changeBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  uploadBtn: {
    flex: 2,
    backgroundColor: colors.teal,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    color: colors.bg,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
