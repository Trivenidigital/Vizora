import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.7;

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const processingRef = useRef(false);

  const extractPairingCode = (data: string): string | null => {
    // QR contains URL like: https://app.vizora.com/dashboard/devices/pair?code=A3K9P2
    // or just the raw 6-char code
    try {
      const url = new URL(data);
      const code = url.searchParams.get('code');
      if (code && /^[A-Z0-9]{6}$/i.test(code)) return code.toUpperCase();
    } catch {
      // Not a URL — check if it's a raw code
    }

    const trimmed = data.trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(trimmed)) return trimmed;

    return null;
  };

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanned(true);

    const code = extractPairingCode(result.data);
    if (code) {
      router.push({ pathname: '/(main)/pair-confirm', params: { code } });
    } else {
      Alert.alert('Invalid QR Code', 'This QR code is not a Vizora pairing code.', [
        {
          text: 'Try Again',
          onPress: () => {
            setScanned(false);
            processingRef.current = false;
          },
        },
      ]);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera access is required to scan QR codes.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay with viewfinder cutout */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.viewfinder}>
            {/* Corner accents */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.instruction}>
            Point your camera at the QR code on the display screen
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.teal,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.bg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  instruction: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.teal,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
});
