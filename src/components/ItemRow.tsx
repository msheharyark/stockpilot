import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../domain/types';
import { colors, radius, space } from '../theme/tokens';

const LOW_STOCK = 10;

function ItemRowBase({ item, onPress }: { item: Item; onPress: (id: string) => void }) {
  const unsynced = item.quantity !== item.serverQuantity;
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.quantity} on hand, location ${item.location}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta}>{item.sku} · {item.location}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.qty, item.quantity < LOW_STOCK && { color: colors.danger }]}>{item.quantity}</Text>
        {unsynced && <Text style={styles.unsynced}>unsynced</Text>}
      </View>
    </Pressable>
  );
}

export const ItemRow = memo(ItemRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { color: colors.muted, marginTop: 2 },
  qty: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  unsynced: { fontSize: 11, color: colors.warning, fontWeight: '600' },
});
