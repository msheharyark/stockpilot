import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useInventory } from './inventoryStore';

const INTERVAL_MS = 30_000;

/** Sync when connectivity returns, when the app comes to the foreground, and on an interval. */
export function useSyncTriggers(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const sync = () => void useInventory.getState().sync();
    let wasConnected = true;

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      if (connected && !wasConnected) sync();
      wasConnected = connected;
    });
    const appState = AppState.addEventListener('change', (s) => s === 'active' && sync());
    const timer = setInterval(sync, INTERVAL_MS);

    return () => {
      unsubscribeNet();
      appState.remove();
      clearInterval(timer);
    };
  }, [enabled]);
}
