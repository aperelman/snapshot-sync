import { SnapperConfig } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_URL || '';

/**
 * Loads snapshot configurations for a given path
 */
export async function loadConfigs(path: string): Promise<SnapperConfig[]> {
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/configs?path=${encodeURIComponent(path)}`
    );
    if (!response.ok) {
      throw new Error('Failed to load configs');
    }
    const data = await response.json();
    return data.configs || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(msg);
  }
}

/**
 * Syncs snapshots between source and target paths
 */
export async function syncSnapshots(
  sourcePath: string,
  targetPath: string,
  configs: string[]
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourcePath,
      targetPath,
      configs,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Sync failed');
  }
}
