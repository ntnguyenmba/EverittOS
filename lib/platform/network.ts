import { Network, type ConnectionStatus } from '@capacitor/network';
import { isNativePlatform } from '@/lib/platform/detect';

export type NetworkState = {
  online: boolean;
  connectionType: string;
};

let cachedState: NetworkState = { online: true, connectionType: 'unknown' };

export function getCachedNetworkState(): NetworkState {
  return cachedState;
}

export async function readNetworkState(): Promise<NetworkState> {
  if (typeof window === 'undefined') return cachedState;

  if (!isNativePlatform()) {
    const online = navigator.onLine;
    cachedState = { online, connectionType: online ? 'web' : 'none' };
    return cachedState;
  }

  const status: ConnectionStatus = await Network.getStatus();
  cachedState = {
    online: status.connected,
    connectionType: status.connectionType
  };
  return cachedState;
}

export async function watchNetwork(
  onChange: (state: NetworkState) => void
): Promise<() => void> {
  if (typeof window === 'undefined') return () => undefined;

  const apply = (online: boolean, connectionType = 'unknown') => {
    cachedState = { online, connectionType };
    onChange(cachedState);
  };

  if (!isNativePlatform()) {
    const handleOnline = () => apply(true, 'web');
    const handleOffline = () => apply(false, 'none');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    apply(navigator.onLine, navigator.onLine ? 'web' : 'none');
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  const handle = await Network.addListener('networkStatusChange', (status) => {
    apply(status.connected, status.connectionType);
  });

  const initial = await Network.getStatus();
  apply(initial.connected, initial.connectionType);

  return () => {
    void handle.remove();
  };
}
