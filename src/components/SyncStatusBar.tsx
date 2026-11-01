import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useInventory } from '../state/inventoryStore';
import { colors, radius, space } from '../theme/tokens';

export function SyncStatusBar() {
  const { syncState, pending, lastSyncedAt, lastReport, sync } = useInventory();
  const rejected = lastReport?.rejected.length ?? 0;

  const { label, tone } =
    syncState === 'syncing'
      ? { label: 'Syncing…', tone: colors.primary }
      : syncState === 'offline'
        ? { label: `Offline · ${pending} change${pending === 1 ? '' : 's'} queued`, tone: colors.warning }
        : syncState === 'error'
          ? { label: 'Sync error · tap to retry', tone: colors.danger }
          : pending > 0
            ? { label: `${pending} change${pending === 1 ? '' : 's'} waiting to sync`, tone: colors.warning }
            : { label: lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Not synced yet', tone: colors.success };

  return (
    <Pressable onPress={() => void sync()} accessibilityRole="button" accessibilityLabel={`${label}. Sync now`}>
      <View style={[styles.bar, { borderColor: tone }]}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text style={styles.text}>{label}</Text>
      </View>
      {rejected > 0 && (
        <Text style={styles.rejected}>
          {rejected} change{rejected === 1 ? ' was' : 's were'} rejected by the server and rolled back.
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.text, fontWeight: '600' },
  rejected: { color: colors.danger, marginTop: space.xs, fontSize: 13 },
});
