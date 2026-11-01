import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getRepository } from '../state/inventoryStore';
import { colors, radius, space } from '../theme/tokens';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] as const;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  // Cameras fire many events per second; a ref lock avoids double navigation without re-rendering.
  const locked = useRef(false);

  const lookup = async (code: string) => {
    if (locked.current) return;
    locked.current = true;
    const item = await getRepository().findByBarcode(code.trim());
    if (item) {
      router.replace(`/item/${item.id}`);
      return;
    }
    setMessage(`No item with barcode ${code}.`);
    setTimeout(() => (locked.current = false), 1500);
  };

  const onScanned = ({ data }: BarcodeScanningResult) => void lookup(data);

  return (
    <View style={styles.screen}>
      {!permission ? null : permission.granted ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={onScanned}
        />
      ) : (
        <View style={styles.permission}>
          <Text style={styles.text}>Camera access is needed to scan barcodes.</Text>
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Allow camera</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.panel}>
        {message && <Text style={styles.error}>{message}</Text>}
        <Text style={styles.label}>Or type a barcode</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="e.g. 4006381333931"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            style={styles.input}
            onSubmitEditing={() => manual && void lookup(manual)}
          />
          <Pressable style={styles.button} onPress={() => manual && void lookup(manual)}>
            <Text style={styles.buttonText}>Find</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  permission: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg, padding: space.xl },
  text: { color: '#fff', textAlign: 'center', fontSize: 16 },
  panel: { backgroundColor: colors.surface, padding: space.lg, gap: space.sm },
  label: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '600' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.md,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
