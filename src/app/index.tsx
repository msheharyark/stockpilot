import { Stack, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ItemRow } from '../components/ItemRow';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { useInventory } from '../state/inventoryStore';
import { backend } from '../sync/backend';
import { colors, radius, space } from '../theme/tokens';

export default function InventoryScreen() {
  const items = useInventory((s) => s.items);
  const syncing = useInventory((s) => s.syncState === 'syncing');
  const sync = useInventory((s) => s.sync);
  const [query, setQuery] = useState('');
  const [simulateOffline, setSimulateOffline] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.name, i.sku, i.barcode, i.location].some((f) => f.toLowerCase().includes(q)));
  }, [items, query]);

  const openItem = useCallback((id: string) => router.push(`/item/${id}`), []);

  const toggleOffline = (value: boolean) => {
    setSimulateOffline(value);
    backend.failureRate = value ? 1 : 0;
    if (!value) void sync();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.offlineToggle}>
              <Text style={styles.offlineLabel}>Offline</Text>
              <Switch value={simulateOffline} onValueChange={toggleOffline} accessibilityLabel="Simulate offline" />
            </View>
          ),
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ItemRow item={item} onPress={openItem} />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        refreshing={syncing}
        onRefresh={() => void sync()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.md }}>
            <SyncStatusBar />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, SKU, barcode or bin"
              placeholderTextColor={colors.muted}
              style={styles.search}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No items match “{query}”.</Text>}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/scan')} accessibilityRole="button">
        <Text style={styles.fabText}>Scan barcode</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    color: colors.text,
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: space.xl },
  fab: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  offlineToggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  offlineLabel: { color: colors.muted },
});
