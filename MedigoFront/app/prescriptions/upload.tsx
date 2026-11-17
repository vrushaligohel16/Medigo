import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { prescriptionService } from '@/services/prescriptionService';
import type { ExtractedMedicine } from '@/types/prescription';

export default function PrescriptionUploadScreen() {
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pickedAsset, setPickedAsset] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [doctorName, setDoctorName] = useState('');
  const [medicines, setMedicines] = useState<ExtractedMedicine[]>([]);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await ImagePicker.getPendingResultAsync();
      if (!result || !('assets' in result) || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      if (asset?.uri) {
        setImageUri(asset.uri);
        setPickedAsset(asset);
        setMedicines([]);
        setUploadedId(null);
      }
    })();
  }, []);

  const resetExtraction = () => {
    setMedicines([]);
    setUploadedId(null);
    setDoctorName('');
    setExtractedText('');
  };

  const pickFromCamera = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera permission needed',
        'Allow camera access to photograph prescriptions.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setPickedAsset(result.assets[0]);
      resetExtraction();
    }
  };

  const pickFromGallery = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo library permission needed',
        'Allow gallery access to choose a prescription image.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setPickedAsset(result.assets[0]);
      resetExtraction();
    }
  };

  const handleExtract = async () => {
    if (!imageUri) {
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const saved = await prescriptionService.upload(imageUri, {
        mimeType: pickedAsset?.mimeType ?? null,
        fileName: pickedAsset?.fileName ?? null,
      });
      setUploadedId(saved.id);
      setMedicines(saved.medicines);
      setDoctorName(saved.doctorName || '');
      setExtractedText(saved.extractedText || saved.notes || '');
    } catch (err) {
      setUploadedId(null);
      setMedicines([]);
      setExtractedText('');
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Upload / OCR failed. Please try again.',
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const updateMedicine = (
    id: string,
    field: 'name' | 'dosage',
    value: string,
  ) => {
    setMedicines((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeMedicine = (id: string) => {
    setMedicines((current) => current.filter((item) => item.id !== id));
  };

  const addMedicineRow = () => {
    setMedicines((current) => [
      ...current,
      { id: `manual-${Date.now()}`, name: '', dosage: '' },
    ]);
  };

  const handleSave = async () => {
    if (!uploadedId) {
      setError('Extract text first to save this prescription.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await prescriptionService.update(uploadedId, {
        doctorName: doctorName.trim(),
        medicines: medicines.filter((item) => item.name.trim()),
        extractedText,
      });
      router.replace('/prescriptions' as Href);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save prescription. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Upload Prescription</Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Add Prescription</Text>
          <Text style={styles.subtitle}>
            Take a photo or choose from gallery, then extract medicines with OCR.
          </Text>

          <View style={styles.pickerRow}>
            <Pressable
              onPress={() => void pickFromCamera()}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
            >
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
              <Text style={styles.pickerText}>Take Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => void pickFromGallery()}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
            >
              <Ionicons name="images-outline" size={22} color={Colors.primary} />
              <Text style={styles.pickerText}>Choose from Gallery</Text>
            </Pressable>
          </View>

          {imageUri ? (
            <View style={styles.previewCard}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <Pressable
                onPress={() => void handleExtract()}
                disabled={isExtracting}
                style={({ pressed }) => [
                  styles.extractButton,
                  pressed && !isExtracting ? styles.pressed : null,
                  isExtracting ? styles.disabled : null,
                ]}
              >
                {isExtracting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={18} color={Colors.white} />
                    <Text style={styles.extractText}>
                      {uploadedId ? 'Re-extract Text' : 'Extract Text'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="document-outline" size={36} color={Colors.textSecondary} />
              <Text style={styles.emptyPreviewText}>No image selected yet</Text>
            </View>
          )}

          <View style={styles.formCard}>
            <InputField
              label="Doctor Name"
              value={doctorName}
              onChangeText={setDoctorName}
              placeholder="Type doctor name if not detected"
              editable={Boolean(uploadedId)}
            />

            {uploadedId && extractedText ? (
              <View style={styles.ocrPreview}>
                <Text style={styles.sectionLabel}>OCR text</Text>
                <Text style={styles.ocrText}>{extractedText}</Text>
              </View>
            ) : null}

            <View style={styles.listHeader}>
              <Text style={styles.sectionLabel}>Extracted Medicines</Text>
              {uploadedId ? (
                <Pressable onPress={addMedicineRow}>
                  <Text style={styles.addRowText}>+ Add</Text>
                </Pressable>
              ) : null}
            </View>

            {!uploadedId ? (
              <Text style={styles.hintText}>
                Run Extract Text to read medicines from this photo. The first scan
                may take a little longer.
              </Text>
            ) : medicines.length === 0 ? (
              <Text style={styles.hintText}>
                No medicines were detected clearly. Use + Add to enter them
                manually.
              </Text>
            ) : (
              medicines.map((item) => (
                <View key={item.id} style={styles.medicineRow}>
                  <TextInput
                    value={item.name}
                    onChangeText={(value) => updateMedicine(item.id, 'name', value)}
                    placeholder="Medicine name"
                    placeholderTextColor={Colors.textSecondary}
                    style={styles.medicineInput}
                  />
                  <TextInput
                    value={item.dosage}
                    onChangeText={(value) => updateMedicine(item.id, 'dosage', value)}
                    placeholder="Dosage"
                    placeholderTextColor={Colors.textSecondary}
                    style={[styles.medicineInput, styles.dosageInput]}
                  />
                  <Pressable onPress={() => removeMedicine(item.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </Pressable>
                </View>
              ))
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={() => void handleSave()}
              disabled={!uploadedId || isSaving}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && uploadedId && !isSaving ? styles.pressed : null,
                !uploadedId || isSaving ? styles.disabled : null,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveText}>Save Prescription</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginTop: -8,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewImage: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.mint,
  },
  extractButton: {
    margin: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  extractText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyPreview: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
  },
  emptyPreviewText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  ocrPreview: {
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ocrText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medicineInput: {
    flex: 1.4,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  dosageInput: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.7,
  },
});
