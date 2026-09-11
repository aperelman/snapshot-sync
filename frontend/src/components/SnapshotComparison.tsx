/**
 * SnapshotComparison Component
 * 
 * Split-screen UI for comparing snapshots between local disk and backup.
 * Left panel: Local Root filesystem
 * Right panel: External Backup disk
 * Center: Bidirectional sync buttons
 */

import React, { useState, useEffect } from 'react';
import styles from './SnapshotComparison.module.css';

interface SnapperConfig {
  name: string;
  path: string;
  snapshotCount: number;
  lastBackup?: string;
}

interface DiskSide {
  label: string;
  path: string;
  configs: SnapperConfig[];
  type: 'local' | 'external';
}

interface AppSettings {
  localPath: string;
  externalPath: string;
}

const apiBaseUrl = import.meta.env.VITE_API_URL || '';
const settingsKey = 'snapshot-comparison-settings';

const defaultSettings: AppSettings = {
  localPath: '/',
  externalPath: '/run/media/amitp/Backup',
};

export const SnapshotComparison: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(settingsKey);
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [left, setLeft] = useState<DiskSide>({
    label: 'Local Root',
    path: settings.localPath,
    configs: [],
    type: 'local',
  });

  const [right, setRight] = useState<DiskSide>({
    label: 'External Backup',
    path: settings.externalPath,
    configs: [],
    type: 'external',
  });

  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem(settingsKey, JSON.stringify(newSettings));
  };

  const loadConfigs = async (path: string): Promise<SnapperConfig[]> => {
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
      setError(msg);
      return [];
    }
  };

  const refreshConfigs = async () => {
    setLoading(true);
    try {
      const [leftConfigs, rightConfigs] = await Promise.all([
        loadConfigs(left.path),
        loadConfigs(right.path),
      ]);
      setLeft((prev) => ({ ...prev, configs: leftConfigs }));
      setRight((prev) => ({ ...prev, configs: rightConfigs }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfigs();
  }, []);

  useEffect(() => {
    refreshConfigs();
  }, [left.path, right.path]);

  const handleSwap = () => {
    const temp = left;
    setLeft(right);
    setRight(temp);
  };

  const handleSettingsSave = (newSettings: AppSettings) => {
    saveSettings(newSettings);
    setLeft((prev) => ({ ...prev, path: newSettings.localPath }));
    setRight((prev) => ({ ...prev, path: newSettings.externalPath }));
    setShowSettings(false);
  };

  const toggleConfig = (configName: string) => {
    const newSelected = new Set(selectedConfigs);
    if (newSelected.has(configName)) {
      newSelected.delete(configName);
    } else {
      newSelected.add(configName);
    }
    setSelectedConfigs(newSelected);
  };

  const handleSync = async (direction: 'leftToRight' | 'rightToLeft') => {
    if (selectedConfigs.size === 0) {
      return;
    }
    setLoading(true);
    try {
      const [source, target] =
        direction === 'leftToRight' ? [left, right] : [right, left];

      const response = await fetch(`${apiBaseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: source.path,
          targetPath: target.path,
          configs: Array.from(selectedConfigs),
        }),
      });
      if (!response.ok) {
        throw new Error('Sync failed');
      }

      await refreshConfigs();
      setSelectedConfigs(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📸 Snapshot Comparison & Sync</h1>
        <div className={styles.headerControls}>
          <button
            onClick={handleSwap}
            className={styles.swapBtn}
            title="Swap left and right"
          >
            ⇄ Swap Sides
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={styles.settingsBtn}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.splitView}>
        <DiskPanel
          disk={left}
          selectedConfigs={selectedConfigs}
          onToggleConfig={toggleConfig}
          onSync={() => handleSync('leftToRight')}
          loading={loading}
          position="left"
        />

        <div className={styles.center}>
          <button
            className={styles.syncRightBtn}
            disabled={selectedConfigs.size === 0 || loading}
            onClick={() => handleSync('leftToRight')}
            title="Sync selected from left to right"
          >
            {loading ? '⏳' : '→'}
          </button>
          <button
            className={styles.syncLeftBtn}
            disabled={selectedConfigs.size === 0 || loading}
            onClick={() => handleSync('rightToLeft')}
            title="Sync selected from right to left"
          >
            {loading ? '⏳' : '←'}
          </button>
        </div>

        <DiskPanel
          disk={right}
          selectedConfigs={selectedConfigs}
          onToggleConfig={toggleConfig}
          onSync={() => handleSync('rightToLeft')}
          loading={loading}
          position="right"
        />
      </div>

      <div className={styles.status}>
        <span>{selectedConfigs.size} config(s) selected</span>
      </div>
    </div>
  );
};

interface DiskPanelProps {
  disk: DiskSide;
  selectedConfigs: Set<string>;
  onToggleConfig: (name: string) => void;
  onSync: () => void;
  loading: boolean;
  position: 'left' | 'right';
}

const DiskPanel: React.FC<DiskPanelProps> = ({
  disk,
  selectedConfigs,
  onToggleConfig,
  loading,
  position,
}) => {
  const icon = disk.type === 'local' ? '💾' : '💿';

  return (
    <div className={styles.panel}>
      <h2>
        {icon} {disk.label}
      </h2>
      <div className={styles.diskPath}>{disk.path}</div>

      <div className={styles.configList}>
        {disk.configs.map((cfg) => (
          <div key={cfg.name} className={styles.configItem}>
            <input
              type="checkbox"
              checked={selectedConfigs.has(cfg.name)}
              onChange={() => onToggleConfig(cfg.name)}
            />
            <div className={styles.configInfo}>
              <div className={styles.configName}>{cfg.name}</div>
              <div className={styles.configMeta}>
                📷 {cfg.snapshotCount} snapshots
                {cfg.lastBackup && ` • ${cfg.lastBackup}`}
              </div>
            </div>
          </div>
        ))}
        {disk.configs.length === 0 && (
          <p className={styles.empty}>No configs found</p>
        )}
      </div>
    </div>
  );
};

interface SettingsPanelProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [localPath, setLocalPath] = useState(settings.localPath);
  const [externalPath, setExternalPath] = useState(settings.externalPath);

  return (
    <div className={styles.settingsPanel}>
      <h3>Default Paths</h3>
      <div className={styles.settingsForm}>
        <div className={styles.settingField}>
          <label>Local Root Path:</label>
          <input
            type="text"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder="/"
          />
        </div>
        <div className={styles.settingField}>
          <label>External Backup Path:</label>
          <input
            type="text"
            value={externalPath}
            onChange={(e) => setExternalPath(e.target.value)}
            placeholder="/run/media/amitp/Backup"
          />
        </div>
        <div className={styles.settingsActions}>
          <button onClick={() => onSave({ localPath, externalPath })} className={styles.saveBtn}>
            Save
          </button>
          <button onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnapshotComparison;
