import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { StockError } from '../../domain/stock';
import type { Movement, MovementReason } from '../../domain/types';
import { getRepository, useInventory } from '../../state/inventoryStore';
import { colors, radius, space } from '../../theme/tokens';

const REASONS: { key: MovementReason; label: string; sign: 1 | -1 }[] = [
  { key: 'receive', label: 'Receive', sign: 1 },
  { key: 'pick', label: 'Pick', sign: -1 },
  { key: 'damage', label: 'Damaged', sign: -1 },
];

const STATUS_COLOR: Record<Movement['status'], string> = {
  pending: colors.warning,
  synced: colors.success,
  rejected: colors.danger,
};

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useInventory((s) => s.items.find((i) => i.id === id));
  const adjust = useInventory((s) => s.adjust);
  const [reason, setReason] = useState<MovementReason>('pick');
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);

  const lastSyncedAt = useInventory((s) => s.lastSyncedAt);

  // Reload history whenever the item changes (local write, sync result or rollback).
  useEffect(() => {
    let cancelled = false;
    getRepository()
      .listMovements(id)
      .then((rows) => !cancelled && setHistory(rows));
    return () => {
      cancelled = true;
    };
  }, [id, item?.quantity, item?.serverQuantity, lastSyncedAt]);

  if (!item) return <Text style={{ padding: space.lg }}>Item not found.</Text>;

  const sign = REASONS.find((r) => r.key === reason)!.sign;

  const apply = async () => {
    setError(null);
    try {
      await adjust(item.id, sign * amount, reason);
      setAmount(1);
    } catch (e) {
      setError(e instanceof StockError ? e.message : 'Could not save this change.');
    }
  };

  return (
    <FlatList
      data={history}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: space.lg, gap: space.sm }}
      ListHeaderComponent={
        <View style={{ gap: space.lg, marginBottom: space.md }}>
          <Stack.Screen options={{ title: item.sku }} />
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>Bin {item.location} · Barcode {item.barcode}</Text>
            <Text style={styles.qty}>{item.quantity}</Text>
            <Text style={styles.meta}>
              {item.quantity === item.serverQuantity
                ? 'on hand · confirmed by server'
                : `on hand · server has ${item.serverQuantity}, your changes are queued`}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.segment}>
              {REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => setReason(r.key)}
                  style={[styles.segmentItem, reason === r.key && styles.segmentActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: reason === r.key }}
                >
                  <Text style={[styles.segmentText, reason === r.key && { color: '#fff' }]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.stepper}>
              <Pressable style={styles.stepButton} onPress={() => setAmount((a) => Math.max(1, a - 1))} accessibilityLabel="Decrease">
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.amount}>{amount}</Text>
              <Pressable style={styles.stepButton} onPress={() => setAmount((a) => a + 1)} accessibilityLabel="Increase">
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.apply} onPress={apply} accessibilityRole="button">
              <Text style={styles.applyText}>
                {sign > 0 ? 'Add' : 'Remove'} {amount}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.section}>History</Text>
        </View>
      }
      renderItem={({ item: m }) => (
        <View style={styles.historyRow}>
          <Text style={styles.historyDelta}>{m.delta > 0 ? `+${m.delta}` : m.delta}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyReason}>{m.reason}</Text>
            <Text style={styles.meta}>{new Date(m.createdAt).toLocaleString()}</Text>
            {m.status === 'rejected' && m.lastError && <Text style={styles.error}>{m.lastError}</Text>}
          </View>
          <Text style={[styles.status, { color: STATUS_COLOR[m.status] }]}>{m.status}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.meta}>No movements recorded on this device yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { color: colors.muted },
  qty: { fontSize: 48, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], marginTop: space.sm },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.sm, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.sm - 2 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontWeight: '600', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl, marginVertical: space.sm },
  stepButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, color: colors.text },
  amount: { fontSize: 32, fontWeight: '700', minWidth: 60, textAlign: 'center', color: colors.text, fontVariant: ['tabular-nums'] },
  error: { color: colors.danger },
  apply: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: space.md, alignItems: 'center' },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, padding: space.md, borderRadius: radius.sm },
  historyDelta: { fontSize: 18, fontWeight: '700', width: 48, color: colors.text, fontVariant: ['tabular-nums'] },
  historyReason: { fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  status: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
});
