import { Stack } from 'expo-router';
import { openDatabaseAsync } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SQLiteRepository, migrate } from '../data/SQLiteRepository';
import { useInventory } from '../state/inventoryStore';
import { useSyncTriggers } from '../state/useSyncTriggers';
import { backend } from '../sync/backend';
import { SyncEngine } from '../sync/SyncEngine';
import { colors } from '../theme/tokens';

export default function RootLayout() {
  const ready = useInventory((s) => s.ready);
  const [error, setError] = useState<string | null>(null);
  useSyncTriggers(ready);

  useEffect(() => {
    (async () => {
      const db = await openDatabaseAsync('stockpilot.db');
      await migrate(db);
      const repo = new SQLiteRepository(db);
      await useInventory.getState().init(repo, new SyncEngine({ repo, api: backend }));
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.danger }}>Could not open the local database: {error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ title: 'Inventory' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan', presentation: 'modal' }} />
      <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
    </Stack>
  );
}
