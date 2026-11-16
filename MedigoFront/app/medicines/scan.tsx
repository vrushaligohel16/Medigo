import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { type Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { medicineService } from '@/services/medicineService';

export default function MedicineScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    const code = result.data?.trim();
    if (!code || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setIsLookingUp(true);
    setErrorMessage(null);

    try {
      const medicine = await medicineService.lookupByBarcode(code);
      const params = new URLSearchParams({
        name: medicine.name,
        ...(medicine.dosage ? { dosage: medicine.dosage } : {}),
        ...(medicine.form ? { form: medicine.form } : {}),
        ...(medicine.quantity != null ? { quantity: String(medicine.quantity) } : {}),
        ...(medicine.notes ? { notes: medicine.notes } : {}),
        barcode: medicine.barcode,
      });

      router.replace(`/medicines/add?${params.toString()}` as Href);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to look up this barcode. Please try again.';
      setErrorMessage(message);
      isProcessingRef.current = false;
    } finally {
      setIsLookingUp(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable onPress={() => router.back()} style={styles.backAbsolute} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>

        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            MediGo needs camera permission to scan medicine barcodes. You can enable
            access below, or enter medicine details manually.
          </Text>

          <Pressable
            onPress={() => void requestPermission()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Allow Camera Access</Text>
          </Pressable>

          {permission.canAskAgain === false ? (
            <Pressable
              onPress={() => void Linking.openSettings()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Open Settings</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.replace('/medicines/add' as Href)}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>Enter details manually</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'code93',
          ],
        }}
        onBarcodeScanned={isLookingUp ? undefined : (result) => void handleBarcodeScanned(result)}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
          <Text style={styles.topTitle}>Scan Barcode</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.frameArea}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.instruction}>Align barcode within frame</Text>
        </View>

        <View style={styles.footer}>
          {isLookingUp ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={Colors.white} />
              <Text style={styles.statusText}>Looking up medicine…</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable
                onPress={() => {
                  setErrorMessage(null);
                  isProcessingRef.current = false;
                }}
              >
                <Text style={styles.retryText}>Tap to scan again</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.hintText}>Hold steady for a moment</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  backAbsolute: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  frameArea: {
    alignItems: 'center',
    gap: 20,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.white,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  instruction: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: 64,
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(214,69,69,0.9)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  retryText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
});
